'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import ErrorBoundary from '@/components/ErrorBoundary';
import PatientNav from '@/components/layout/PatientNav';
import { PatternRecallGame } from '@/components/games/memory-blocks/PatternRecallGame';
import { MEMORY_BLOCKS_MESSAGES } from '@/components/games/memory-blocks/messages';
import { useDifficulty } from '@/hooks/useDifficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { useTranslation } from '@/lib/i18n/provider';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

export default function MemoryBlocksPage() {
  return (
    <ErrorBoundary>
      <MemoryBlocksPageInner />
    </ErrorBoundary>
  );
}

function MemoryBlocksPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const { state: difficulty, applySession } = useDifficulty('memory_blocks');

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onComplete = async (score: number, levelReached: number) => {
    // Levels reached (3+) map onto this app's 1-8 difficulty scale for cross-session persistence.
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
        gameType: 'memory_blocks',
        difficultyLevel: difficulty.currentLevel,
        roundNumber: levelReached,
        isCorrect: score > 0,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { score, levelReached },
      });
    }
    void applySession(normalizedAccuracy);
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'memory_blocks');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.memoryBlocks.name')}
        onBack={() => {
          void goHome();
        }}
      />
      <main className="flex flex-1 flex-col px-4 py-6">
        <NextIntlClientProvider locale={language} messages={MEMORY_BLOCKS_MESSAGES[language as keyof typeof MEMORY_BLOCKS_MESSAGES] ?? MEMORY_BLOCKS_MESSAGES.en}>
          <PatternRecallGame initialLevel={difficulty.currentLevel} onComplete={onComplete} />
        </NextIntlClientProvider>
      </main>
    </div>
  );
}
