'use client';

import { useEffect, useRef } from 'react';
import BigButton from './BigButton';
import { playAudio } from '@/lib/audio/player';
import { useTranslation } from '@/lib/i18n/provider';
import type { LocalReminderSchedule } from '@/lib/db/schema';
import type { ReminderType } from '@/lib/supabase/types';

export interface ReminderCardProps {
  reminder: LocalReminderSchedule;
  onAcknowledge: () => void;
  onSnooze: () => void;
}

const ICON: Record<ReminderType, { emoji: string; bg: string }> = {
  medication: { emoji: '💊', bg: 'bg-primary/20' },
  hydration: { emoji: '💧', bg: 'bg-blue-100' },
  activity: { emoji: '🚶', bg: 'bg-green-100' },
  appointment: { emoji: '📅', bg: 'bg-orange-100' },
};

const DONE_LABEL = 'Done ✓';

/**
 * Full-screen overlay for a due reminder. Snooze only dismisses the card:
 * the reminder stays unacknowledged, so `useReminders`' next 60s poll picks
 * it back up as still-due — that stands in for an internal re-trigger timer,
 * which can't outlive a card that unmounts on dismiss.
 */
export default function ReminderCard({ reminder, onAcknowledge, onSnooze }: ReminderCardProps) {
  const { language } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const icon = ICON[reminder.reminderType];

  useEffect(() => {
    playAudio('', reminder.label, language);
    cardRef.current
      ?.querySelector<HTMLButtonElement>(`[aria-label="${DONE_LABEL}"]`)
      ?.focus();
    // Fire once, when this reminder appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div ref={cardRef} className="mx-4 max-w-patient rounded-tile bg-surface-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full ${icon.bg}`}
            aria-hidden="true"
          >
            <span className="text-5xl">{icon.emoji}</span>
          </div>
          <p className="text-caregiver-body text-ink-muted">It is time for:</p>
          <p className="text-patient-heading font-bold text-ink">{reminder.label}</p>

          <BigButton label={DONE_LABEL} variant="success" onClick={onAcknowledge} />

          <button type="button" onClick={onSnooze} className="text-ink-muted underline">
            Remind me in 15 minutes
          </button>
        </div>
      </div>
    </div>
  );
}
