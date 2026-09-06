'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import ErrorBoundary from '@/components/ErrorBoundary';
import PatientNav from '@/components/layout/PatientNav';
import MemoryTestGame from '@/components/games/memory-span/MemoryTestGame';
import { MEMORY_SPAN_MESSAGES } from '@/components/games/memory-span/messages';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { useTranslation } from '@/lib/i18n/provider';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

export default function MemorySpanPage() {
  return (
    <ErrorBoundary>
      <MemorySpanPageInner />
    </ErrorBoundary>
  );
}

function MemorySpanPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.memory_span ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onComplete = (score: number) => {
    const next = adjustDifficulty(difficulty, 'memory_span', score, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'memory_span', next.currentLevel);
      void logEvent({
        sessionId: activeSession?.id ?? '',
        patientId: currentPatient.id,
        gameType: 'memory_span',
        difficultyLevel: difficulty.currentLevel,
        roundNumber: 1,
        isCorrect: score >= 50,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { score },
      });
    }
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'memory_span');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.memorySpan.name')}
        onBack={() => {
          void goHome();
        }}
      />
      <main className="flex flex-1 flex-col px-4 py-6">
        <NextIntlClientProvider locale={language} messages={MEMORY_SPAN_MESSAGES[language]}>
          <MemoryTestGame onComplete={onComplete} />
        </NextIntlClientProvider>
      </main>
    </div>
  );
}
