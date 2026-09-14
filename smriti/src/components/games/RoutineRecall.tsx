'use client';

import { useEffect, useMemo, useState } from 'react';
import { REMINDER_ICON } from '@/components/ui/ReminderCard';
import { BIG_TARGET_MIN_PX } from '@/components/ui/touchTarget';
import {
  getRoutineRecallSequence,
  isCorrectOrder,
  shuffleSequence,
  type RoutineRecallItem,
} from '@/lib/games/routine-recall';
import type { ReminderType } from '@/lib/supabase/types';

export interface RoutineRecallProps {
  patientId: string;
  sequenceLength: number;
  onComplete: (correct: boolean, submittedOrder: string[]) => void;
}

const LABEL: Record<ReminderType, string> = {
  medication: 'Medication',
  hydration: 'Hydration',
  activity: 'Activity',
  appointment: 'Appointment',
};

type Phase = 'loading' | 'insufficient' | 'playing' | 'done';

/**
 * The patient's own real reminder_acks for the day, reordered from a
 * shuffled display back into the sequence they actually happened in.
 * Never generates synthetic content — see lib/games/routine-recall.ts.
 */
export default function RoutineRecall({ patientId, sequenceLength, onComplete }: RoutineRecallProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [correctSequence, setCorrectSequence] = useState<RoutineRecallItem[]>([]);
  const [displayOrder, setDisplayOrder] = useState<RoutineRecallItem[]>([]);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [wasCorrect, setWasCorrect] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRoutineRecallSequence(patientId, sequenceLength).then((result) => {
      if (cancelled) return;
      if (result.status === 'insufficient') {
        setPhase('insufficient');
        return;
      }
      setCorrectSequence(result.sequence);
      setDisplayOrder(shuffleSequence(result.sequence));
      setPhase('playing');
    });
    return () => {
      cancelled = true;
    };
    // Re-runs only if the patient or requested length changes, not on every render.
  }, [patientId, sequenceLength]);

  const remaining = useMemo(
    () => displayOrder.filter((item) => !submitted.includes(item.ackId)),
    [displayOrder, submitted],
  );

  const tap = (ackId: string) => {
    if (phase !== 'playing') return;
    const next = [...submitted, ackId];
    setSubmitted(next);

    if (next.length === correctSequence.length) {
      const correct = isCorrectOrder(correctSequence, next);
      setWasCorrect(correct);
      setPhase('done');
      onComplete(correct, next);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-game-bg px-4" aria-busy="true">
        <p className="text-patient-body text-ink">Getting today&apos;s routine ready…</p>
      </div>
    );
  }

  if (phase === 'insufficient') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-game-bg px-4 text-center">
        <p className="text-4xl" aria-hidden="true">
          🗓️
        </p>
        <p className="text-patient-body font-semibold text-ink">
          Not enough reminder activity yet today for Routine Recall
        </p>
        <p className="text-sm text-ink-muted">
          Come back after a few more reminders have been checked off today.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col gap-6 bg-game-bg px-4 py-6">
      <p className="text-center text-patient-body font-semibold text-ink">
        Tap them in the order you did them today
      </p>

      <div className="grid grid-cols-2 gap-4">
        {(phase === 'playing' ? remaining : displayOrder).map((item) => {
          const icon = REMINDER_ICON[item.reminderType];
          const placed = phase === 'done' && submitted.includes(item.ackId);
          return (
            <button
              key={item.ackId}
              type="button"
              onClick={() => tap(item.ackId)}
              disabled={phase !== 'playing'}
              style={{ minHeight: BIG_TARGET_MIN_PX }}
              className={
                'flex flex-col items-center justify-center gap-2 rounded-tile border-2 ' +
                `${icon.bg} ` +
                (placed
                  ? 'border-success/50'
                  : 'border-transparent hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0')
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icon.src} alt="" className="h-12 w-12" />
              <span className="text-patient-body font-semibold text-ink">
                {LABEL[item.reminderType]}
              </span>
            </button>
          );
        })}
      </div>

      {submitted.length > 0 && phase === 'playing' ? (
        <p className="text-center text-sm text-ink-muted" aria-live="polite">
          {submitted.length} of {correctSequence.length} placed
        </p>
      ) : null}

      {phase === 'done' ? (
        <div className="flex flex-col items-center gap-3 rounded-tile border border-line200 bg-surface-card p-6 text-center">
          <p className="text-patient-body font-semibold text-ink">
            {wasCorrect ? 'Wonderful! That is exactly how today went.' : "Let's remember together."}
          </p>
          {!wasCorrect ? (
            <ol className="flex flex-col gap-1 text-sm text-ink-muted">
              {correctSequence.map((item, i) => (
                <li key={item.ackId}>
                  {i + 1}. {LABEL[item.reminderType]}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
