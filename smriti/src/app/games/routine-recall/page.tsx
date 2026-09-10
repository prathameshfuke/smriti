'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import PatientNav from '@/components/layout/PatientNav';
import RoutineRecall from '@/components/games/RoutineRecall';
import SessionComplete from '@/components/games/SessionComplete';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { starsFromRate } from '@/lib/engine/scoring';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { ROUTINE_RECALL_LEVELS } from '@/lib/games/routine-recall';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

type Phase = 'playing' | 'session_complete';

export default function RoutineRecallPage() {
  return (
    <ErrorBoundary>
      <RoutineRecallPageInner />
    </ErrorBoundary>
  );
}

function RoutineRecallPageInner() {
  const router = useRouter();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [phase, setPhase] = useState<Phase>('playing');
  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.routine_recall ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));
  const [wasCorrect, setWasCorrect] = useState(false);

  const sequenceLength = (ROUTINE_RECALL_LEVELS[difficulty.currentLevel] ?? ROUTINE_RECALL_LEVELS[1])
    .sequenceLength;

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // Only run once, when the page mounts with a real patient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleComplete = useCallback(
    async (correct: boolean) => {
      // Awaited, not fire-and-forget: logEvent writes to Dexie before
      // mirroring into gameStore.sessionEvents (lib/engine/telemetry.ts),
      // and adjustDifficulty below reads sessionEvents synchronously.
      // Already called before adjustDifficulty (unlike the other games'
      // read-then-log ordering bug) — this only needed the await, not a
      // reorder.
      if (currentPatient) {
        await logEvent({
          sessionId: activeSession?.id ?? '',
          patientId: currentPatient.id,
          gameType: 'routine_recall',
          difficultyLevel: difficulty.currentLevel,
          roundNumber: 1,
          isCorrect: correct,
          responseTimeMs: null,
          eventTimestamp: new Date().toISOString(),
          metadata: { sequenceLength },
        });
      }

      setWasCorrect(correct);
      const next = adjustDifficulty(difficulty, 'routine_recall', correct ? 100 : 0, useGameStore.getState().sessionEvents);
      setDifficulty(next);
      if (currentPatient) {
        // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
        void usePatientStore.getState().updateDifficulty(currentPatient.id, 'routine_recall', next.currentLevel);
      }
      setPhase('session_complete');
    },
    [currentPatient, activeSession, difficulty, sequenceLength],
  );

  const stars = starsFromRate(wasCorrect ? 1 : 0);

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'routine_recall');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title="Routine Recall"
        onBack={() => {
          void endSession();
          router.push('/app');
        }}
      />

      <main className="flex flex-1 flex-col">
        {phase === 'playing' && currentPatient ? (
          <RoutineRecall
            patientId={currentPatient.id}
            sequenceLength={sequenceLength}
            onComplete={handleComplete}
          />
        ) : null}

        {phase === 'session_complete' ? (
          <SessionComplete
            gameType="routine_recall"
            stars={stars}
            correctCount={wasCorrect ? 1 : 0}
            totalCount={1}
            onGoHome={goHome}
          />
        ) : null}
      </main>
    </div>
  );
}
