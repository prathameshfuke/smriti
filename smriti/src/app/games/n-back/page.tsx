'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import ErrorBoundary from '@/components/ErrorBoundary';
import PatientNav from '@/components/layout/PatientNav';
import GameComponent from '@/components/games/n-back/GameComponent';
import { N_BACK_MESSAGES } from '@/components/games/n-back/messages';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { useTranslation } from '@/lib/i18n/provider';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

export default function NBackPage() {
  return (
    <ErrorBoundary>
      <NBackPageInner />
    </ErrorBoundary>
  );
}

function NBackPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.n_back ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onComplete = async (accuracy: number, level: number) => {
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
        gameType: 'n_back',
        difficultyLevel: difficulty.currentLevel,
        roundNumber: level,
        isCorrect: accuracy >= 50,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { accuracy, nBackLevel: level },
      });
    }
    const next = adjustDifficulty(difficulty, 'n_back', accuracy, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'n_back', next.currentLevel);
    }
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'n_back');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.nBack.name')}
        onBack={() => {
          void goHome();
        }}
      />
      <main className="flex flex-1 flex-col px-4 py-6">
        <NextIntlClientProvider locale={language} messages={N_BACK_MESSAGES[language as keyof typeof N_BACK_MESSAGES] ?? N_BACK_MESSAGES.en}>
          <GameComponent onComplete={onComplete} />
        </NextIntlClientProvider>
      </main>
    </div>
  );
}
