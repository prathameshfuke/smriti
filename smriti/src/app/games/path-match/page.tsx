'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import BigButton from '@/components/ui/BigButton';
import PatientNav from '@/components/layout/PatientNav';
import PathCanvas from '@/components/games/PathCanvas';
import SessionComplete from '@/components/games/SessionComplete';
import GameTutorial, { TUTORIALS } from '@/components/games/GameTutorial';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { starsFromRate } from '@/lib/engine/scoring';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { generatePointLayout } from '@/lib/games/pathMatchLayout';
import { speak } from '@/lib/audio/speech';
import { narrate } from '@/lib/audio/narrate';
import { useTranslation } from '@/lib/i18n/provider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

type Phase = 'instruction' | 'playing' | 'round_complete' | 'session_complete';

interface LevelParams {
  numPoints: number;
  timerSeconds: number | null;
}

/** Point count and (from L3) a countdown, per the Trail Making Test difficulty table. */
const LEVELS: Record<number, LevelParams> = {
  1: { numPoints: 4, timerSeconds: null },
  2: { numPoints: 5, timerSeconds: null },
  3: { numPoints: 6, timerSeconds: 60 },
  4: { numPoints: 7, timerSeconds: 45 },
  5: { numPoints: 8, timerSeconds: 45 },
  6: { numPoints: 9, timerSeconds: 40 },
  7: { numPoints: 10, timerSeconds: 35 },
  8: { numPoints: 12, timerSeconds: 30 },
};

export default function PathMatchPage() {
  return (
    <ErrorBoundary>
      <PathMatchPageInner />
    </ErrorBoundary>
  );
}

function PathMatchPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [phase, setPhase] = useState<Phase>('instruction');
  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.path_match ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));
  const [round, setRound] = useState(1);
  /** 1-indexed: the point the patient must tap next. */
  const [currentTarget, setCurrentTarget] = useState(1);
  const [completedPairs, setCompletedPairs] = useState<Array<{ from: number; to: number }>>([]);
  const [wrongTapShowing, setWrongTapShowing] = useState(false);
  const [wrongTaps, setWrongTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [playStartedAt, setPlayStartedAt] = useState(0);

  // Random per page visit so the same level never replays the same board
  // across sessions or rounds (issue #4: "shows the same level").
  const [sessionVariant] = useState(() => Math.floor(Math.random() * 1000));

  const level = LEVELS[difficulty.currentLevel] ?? LEVELS[1];
  const points = useMemo(
    () => generatePointLayout(level.numPoints, difficulty.currentLevel, sessionVariant + round),
    [level.numPoints, difficulty.currentLevel, sessionVariant, round],
  );

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'instruction') return;
    void narrate(t('game.pathMatch.instruction'), language, isOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const completeRound = useCallback(
    async (finalPairs: Array<{ from: number; to: number }>, finalWrongTaps: number) => {
      const totalConnections = points.length - 1;
      const timeUsedMs = Date.now() - playStartedAt;

      if (currentPatient) {
        // Awaited, not fire-and-forget: logEvent writes to Dexie before
        // mirroring into gameStore.sessionEvents (lib/engine/telemetry.ts),
        // and keepGoing/finishSession read sessionEvents synchronously to
        // feed the difficulty ML model. Without this await, a patient
        // tapping "Finish Session" before that write lands would silently
        // fall back to the less-informed rule-based difficulty path instead
        // — a real race on a slow/loaded device, this app's actual target
        // hardware, not just a timing quirk in tests.
        await logEvent({
          sessionId: activeSession?.id ?? '',
          patientId: currentPatient.id,
          gameType: 'path_match',
          difficultyLevel: difficulty.currentLevel,
          roundNumber: round,
          isCorrect: finalPairs.length === totalConnections,
          responseTimeMs: timeUsedMs,
          eventTimestamp: new Date().toISOString(),
          metadata: {
            completedConnections: finalPairs.length,
            totalConnections,
            timeUsedMs,
            wrongTaps: finalWrongTaps,
          },
        });
      }

      setPhase('round_complete');
    },
    [points.length, playStartedAt, currentPatient, activeSession, difficulty.currentLevel, round],
  );

  const startPlaying = () => {
    setCurrentTarget(1);
    setCompletedPairs([]);
    setWrongTaps(0);
    setTimeLeft(level.timerSeconds);
    setPlayStartedAt(Date.now());
    setPhase('playing');
  };

  // Countdown timer, only mounted for levels that have one.
  useEffect(() => {
    if (phase !== 'playing' || level.timerSeconds == null) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev == null || prev <= 0 ? prev : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, level.timerSeconds]);

  useEffect(() => {
    if (phase !== 'playing' || timeLeft !== 0) return;
    // Timer ran out mid-round: end here with whatever was completed so far.
    // Deferred one microtask per this codebase's convention for effect-derived state changes.
    queueMicrotask(() => void completeRound(completedPairs, wrongTaps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  const onPointTap = useCallback(
    (index: number) => {
      if (phase !== 'playing') return;

      if (index === currentTarget - 1) {
        const nextTarget = currentTarget + 1;
        const nextPairs =
          currentTarget > 1
            ? [...completedPairs, { from: currentTarget - 2, to: currentTarget - 1 }]
            : completedPairs;
        setCompletedPairs(nextPairs);

        if (nextTarget % 3 === 0) speak(t('game.pathMatch.good'), language);

        if (nextTarget > points.length) {
          void completeRound(nextPairs, wrongTaps);
        } else {
          setCurrentTarget(nextTarget);
        }
      } else {
        const nextWrongTaps = wrongTaps + 1;
        setWrongTaps(nextWrongTaps);
        setWrongTapShowing(true);
        setTimeout(() => setWrongTapShowing(false), 300);
      }
    },
    [phase, currentTarget, completedPairs, wrongTaps, points.length, completeRound, t, language],
  );

  const totalConnections = Math.max(1, points.length - 1);
  const score = completedPairs.length / totalConnections;
  const stars = starsFromRate(score);

  const keepGoing = () => {
    const next = adjustDifficulty(difficulty, 'path_match', score * 100, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'path_match', next.currentLevel);
    }
    setRound((r) => r + 1);
    setPhase('instruction');
  };

  const finishSession = () => {
    const next = adjustDifficulty(difficulty, 'path_match', score * 100, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'path_match', next.currentLevel);
    }
    setPhase('session_complete');
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'path_match');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.pathMatch.name')}
        onBack={() => {
          void endSession();
          router.push('/app');
        }}
      />

      <main className="flex flex-1 flex-col items-center gap-4 px-4 py-6">
        {phase === 'instruction' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink">{t('game.pathMatch.instruction')}</p>
            <div className="flex items-center gap-2" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-ink-inverse animate-pulse motion-reduce:animate-none"
                >
                  {n}
                </span>
              ))}
            </div>
            <BigButton label={t('game.start')} variant="primary" onClick={startPlaying} />
            <GameTutorial gameId="path_match" steps={TUTORIALS.path_match} />
          </div>
        ) : null}

        {phase === 'playing' ? (
          <div className="flex w-full flex-1 flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <p data-testid="current-target-label" className="text-patient-body text-ink">
                {t('game.pathMatch.pointOf', { n: currentTarget, total: points.length })}
              </p>
              {timeLeft != null ? (
                <p
                  className={
                    'text-patient-heading ' + (timeLeft < 10 ? 'text-danger' : 'text-ink')
                  }
                >
                  {timeLeft}s
                </p>
              ) : null}
            </div>
            <div className="flex-1">
              <PathCanvas
                points={points}
                currentTarget={currentTarget - 1}
                onPointTap={onPointTap}
                completedPath={completedPairs}
                wrongTap={wrongTapShowing}
              />
            </div>
          </div>
        ) : null}

        {phase === 'round_complete' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-4xl text-primary" aria-hidden="true">
              {'★'.repeat(stars)}
              {'☆'.repeat(5 - stars)}
            </p>
            <p className="font-serif-display text-patient-heading text-ink">
              {t('game.pathMatch.connected', { count: completedPairs.length, total: totalConnections })}
            </p>
            <BigButton label={t('game.anotherRound')} variant="primary" onClick={keepGoing} />
            <BigButton label={t('game.finishSession')} variant="secondary" onClick={finishSession} />
          </div>
        ) : null}

        {phase === 'session_complete' ? (
          <SessionComplete
            gameType="path_match"
            stars={stars}
            correctCount={completedPairs.length}
            totalCount={totalConnections}
            onGoHome={goHome}
          />
        ) : null}
      </main>
    </div>
  );
}
