'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import ErrorBoundary from '@/components/ErrorBoundary';
import PatientNav from '@/components/layout/PatientNav';
import GameComponent from '@/components/games/frog-leap/GameComponent';
import { FROG_LEAP_MESSAGES } from '@/components/games/frog-leap/messages';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { useTranslation } from '@/lib/i18n/provider';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

export default function FrogLeapPage() {
  return (
    <ErrorBoundary>
      <FrogLeapPageInner />
    </ErrorBoundary>
  );
}

function FrogLeapPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.frog_leap ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onComplete = (score: number, levelReached: number) => {
    const normalizedAccuracy = Math.min(100, levelReached * 12);
    const next = adjustDifficulty(difficulty, 'frog_leap', normalizedAccuracy, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'frog_leap', next.currentLevel);
      void logEvent({
        sessionId: activeSession?.id ?? '',
        patientId: currentPatient.id,
        gameType: 'frog_leap',
        difficultyLevel: next.currentLevel,
        roundNumber: levelReached,
        isCorrect: score > 0,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { score, levelReached },
      });
    }
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'frog_leap');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.frogLeap.name')}
        onBack={() => {
          void goHome();
        }}
      />
      <main className="flex flex-1 flex-col">
        <NextIntlClientProvider locale={language} messages={FROG_LEAP_MESSAGES[language]}>
          <GameComponent onComplete={onComplete} />
        </NextIntlClientProvider>
      </main>
    </div>
  );
}
