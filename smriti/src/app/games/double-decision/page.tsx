'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import ErrorBoundary from '@/components/ErrorBoundary';
import PatientNav from '@/components/layout/PatientNav';
import { PeripheralSpeedGame } from '@/components/games/double-decision/PeripheralSpeedGame';
import { DOUBLE_DECISION_MESSAGES } from '@/components/games/double-decision/messages';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { useTranslation } from '@/lib/i18n/provider';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

export default function DoubleDecisionPage() {
  return (
    <ErrorBoundary>
      <DoubleDecisionPageInner />
    </ErrorBoundary>
  );
}

function DoubleDecisionPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.double_decision ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onComplete = (accuracy: number, maxFieldReached: number) => {
    const next = adjustDifficulty(difficulty, 'double_decision', accuracy, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'double_decision', next.currentLevel);
      void logEvent({
        sessionId: activeSession?.id ?? '',
        patientId: currentPatient.id,
        gameType: 'double_decision',
        difficultyLevel: next.currentLevel,
        roundNumber: maxFieldReached,
        isCorrect: accuracy >= 50,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { accuracy, maxFieldReached },
      });
    }
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'double_decision');
    }
    await endSession();
    router.push('/app');
  };

  return (
    // Wider than the app's usual `max-w-patient` (480px): this game's play
    // field needs room for peripheral targets to actually sit in the
    // periphery — the standard patient-page width crowds the whole game
    // into a strip too narrow to be legible or fun.
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <PatientNav
        title={t('game.doubleDecision.name')}
        onBack={() => {
          void goHome();
        }}
      />
      <main className="flex flex-1 flex-col px-4 py-6">
        <NextIntlClientProvider locale={language} messages={DOUBLE_DECISION_MESSAGES[language]}>
          <PeripheralSpeedGame onComplete={onComplete} />
        </NextIntlClientProvider>
      </main>
    </div>
  );
}
