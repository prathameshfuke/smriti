'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import ErrorBoundary from '@/components/ErrorBoundary';
import PatientNav from '@/components/layout/PatientNav';
import GameTutorial, { TUTORIALS } from '@/components/games/GameTutorial';
import GameComponent from '@/components/games/counting-boxes/GameComponent';
import { COUNTING_BOXES_MESSAGES } from '@/components/games/counting-boxes/messages';
import { useDifficulty } from '@/hooks/useDifficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { useTranslation } from '@/lib/i18n/provider';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

export default function CountingBoxesPage() {
  return (
    <ErrorBoundary>
      <CountingBoxesPageInner />
    </ErrorBoundary>
  );
}

function CountingBoxesPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const { state: difficulty, applySession } = useDifficulty('counting_boxes');

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onComplete = async (accuracyPct: number, levelsPlayed: number) => {
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
        gameType: 'counting_boxes',
        difficultyLevel: difficulty.currentLevel,
        roundNumber: levelsPlayed,
        isCorrect: accuracyPct >= 50,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { accuracyPct },
      });
    }
    void applySession(accuracyPct);
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'counting_boxes');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.countingBoxes.name')}
        onBack={() => {
          void goHome();
        }}
      />
      <main className="flex flex-1 flex-col">
        <div className="flex justify-center px-4 pt-4">
          <GameTutorial gameId="counting_boxes" steps={TUTORIALS.counting_boxes} />
        </div>
        <NextIntlClientProvider locale={language} messages={COUNTING_BOXES_MESSAGES[language as keyof typeof COUNTING_BOXES_MESSAGES] ?? COUNTING_BOXES_MESSAGES.en}>
          <GameComponent initialLevel={difficulty.currentLevel} onComplete={onComplete} />
        </NextIntlClientProvider>
      </main>
    </div>
  );
}
