'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import ErrorBoundary from '@/components/ErrorBoundary';
import PatientNav from '@/components/layout/PatientNav';
import GameComponent from '@/components/games/fish-trace/GameComponent';
import { FISH_TRACE_MESSAGES } from '@/components/games/fish-trace/messages';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { useTranslation } from '@/lib/i18n/provider';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

export default function FishTracePage() {
  return (
    <ErrorBoundary>
      <FishTracePageInner />
    </ErrorBoundary>
  );
}

function FishTracePageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.fish_trace ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onComplete = async (score: number, levelReached: number) => {
    const normalizedAccuracy = Math.min(100, levelReached * 12);
    // Awaited and moved before adjustDifficulty: logEvent writes to Dexie
    // before mirroring into gameStore.sessionEvents (lib/engine/telemetry.ts).
    // This previously fired fire-and-forget AFTER adjustDifficulty had
    // already read sessionEvents, so the ML model never saw this session's
    // own event — not racily, every single time, since this callback only
    // ever logs once per session. difficultyLevel now records the level
    // this round was actually played at (matches path-match's convention),
    // since `next` doesn't exist yet at log time.
    if (currentPatient) {
      await logEvent({
        sessionId: activeSession?.id ?? '',
        patientId: currentPatient.id,
        gameType: 'fish_trace',
        difficultyLevel: difficulty.currentLevel,
        roundNumber: levelReached,
        isCorrect: score > 0,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { score, levelReached },
      });
    }
    const next = adjustDifficulty(difficulty, 'fish_trace', normalizedAccuracy, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'fish_trace', next.currentLevel);
    }
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'fish_trace');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.fishTrace.name')}
        onBack={() => {
          void goHome();
        }}
      />
      <main className="flex flex-1 flex-col">
        <NextIntlClientProvider locale={language} messages={FISH_TRACE_MESSAGES[language as keyof typeof FISH_TRACE_MESSAGES] ?? FISH_TRACE_MESSAGES.en}>
          <GameComponent initialLevel={difficulty.currentLevel} onComplete={onComplete} />
        </NextIntlClientProvider>
      </main>
    </div>
  );
}
