'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import ErrorBoundary from '@/components/ErrorBoundary';
import PatientNav from '@/components/layout/PatientNav';
import GameComponent from '@/components/games/reminiscence-quiz/GameComponent';
import { REMINISCENCE_QUIZ_MESSAGES } from '@/components/games/reminiscence-quiz/messages';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { useTranslation } from '@/lib/i18n/provider';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { db, type LocalReminiscenceQuiz } from '@/lib/db/schema';

export default function ReminiscenceQuizPage() {
  return (
    <ErrorBoundary>
      <ReminiscenceQuizPageInner />
    </ErrorBoundary>
  );
}

function ReminiscenceQuizPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [quiz, setQuiz] = useState<LocalReminiscenceQuiz | null | undefined>(undefined);
  const [entryPhotos, setEntryPhotos] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentPatient) return;
    void db.reminiscenceQuizzes
      .where('patientId')
      .equals(currentPatient.id)
      .first()
      .then((row) => setQuiz(row ?? null));
    void db.memoryBankEntries
      .where('patientId')
      .equals(currentPatient.id)
      .toArray()
      .then((entries) => {
        const map: Record<string, string | null> = {};
        for (const entry of entries) map[entry.title] = entry.photoUrl;
        setEntryPhotos(map);
      });
  }, [currentPatient]);

  const onComplete = (accuracyPct: number) => {
    // No difficulty adjustment for this game — a fixed 5-question quiz has
    // no meaningful "harder" tier (see MAX_LEVEL.reminiscence_quiz).
    if (currentPatient) {
      // SAFE-FIRE-AND-FORGET: no downstream sessionEvents read exists in this file (fixed 5-question quiz, no difficulty tier — see MAX_LEVEL.reminiscence_quiz)
      void logEvent({
        sessionId: activeSession?.id ?? '',
        patientId: currentPatient.id,
        gameType: 'reminiscence_quiz',
        difficultyLevel: 1,
        roundNumber: 5,
        isCorrect: accuracyPct >= 50,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { accuracyPct },
      });
    }
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'reminiscence_quiz');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.reminiscenceQuiz.name')}
        onBack={() => {
          void goHome();
        }}
      />
      <main className="flex flex-1 flex-col">
        <NextIntlClientProvider locale={language} messages={REMINISCENCE_QUIZ_MESSAGES[language as keyof typeof REMINISCENCE_QUIZ_MESSAGES] ?? REMINISCENCE_QUIZ_MESSAGES.en}>
          {quiz === undefined ? null : quiz === null ? (
            <NoQuizYet />
          ) : (
            <GameComponent
              quiz={quiz}
              entryPhotos={entryPhotos}
              onComplete={onComplete}
              onGoHome={() => {
                void goHome();
              }}
            />
          )}
        </NextIntlClientProvider>
      </main>
    </div>
  );
}

function NoQuizYet() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-patient-body text-ink-muted">
        No quiz is ready yet. Ask your caregiver to set one up.
      </p>
    </div>
  );
}
