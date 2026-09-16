'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import BigButton from '@/components/ui/BigButton';
import PatientNav from '@/components/layout/PatientNav';
import MemoryGrid, { type MemoryTile } from '@/components/games/MemoryGrid';
import SessionComplete from '@/components/games/SessionComplete';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { starsFromRate } from '@/lib/engine/scoring';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { OBJECTS } from '@/lib/engine/objects';
import { speak, GAME_SPEECH_RATE } from '@/lib/audio/speech';
import { narrate } from '@/lib/audio/narrate';
import { useTranslation } from '@/lib/i18n/provider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { slower } from '@/lib/games/pacing';

type Phase = 'instruction' | 'playing' | 'round_complete' | 'session_complete';

/**
 * Pair counts per difficulty level. Previously capped at 4 pairs (8 tiles)
 * across only 3 levels, which plateaued almost immediately and read as "the
 * same game every time" — this now climbs to 8 pairs (16 tiles), the most
 * the 12-object pool in `OBJECTS` can support without repeating an image
 * within one board.
 */
const LEVELS: Record<number, { pairs: number }> = {
  1: { pairs: 2 },
  2: { pairs: 3 },
  3: { pairs: 4 },
  4: { pairs: 5 },
  5: { pairs: 6 },
  6: { pairs: 8 },
};

/** Slowed 20% (pacing.SLOWDOWN) per clinical feedback so a flipped pair
 * stays visible long enough to actually study before it flips back. */
const MISMATCH_DELAY_MS = slower(900);
const MATCH_DELAY_MS = slower(500);

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildTiles(pairs: number): MemoryTile[] {
  const chosen = shuffle(OBJECTS).slice(0, pairs);
  const doubled = chosen.flatMap((object, pairId) => [
    { object, pairId, matched: false },
    { object, pairId, matched: false },
  ]);
  return shuffle(doubled);
}

export default function MemoryMatchPage() {
  return (
    <ErrorBoundary>
      <MemoryMatchPageInner />
    </ErrorBoundary>
  );
}

function MemoryMatchPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [phase, setPhase] = useState<Phase>('instruction');
  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.memory_match ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));
  const [round, setRound] = useState(1);
  const [tiles, setTiles] = useState<MemoryTile[]>([]);
  const [faceUpIndices, setFaceUpIndices] = useState<number[]>([]);
  const [inputLocked, setInputLocked] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [playStartedAt, setPlayStartedAt] = useState(0);

  const level = LEVELS[difficulty.currentLevel] ?? LEVELS[1];

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'instruction') return;
    void narrate(t('game.memoryMatch.instruction'), language, isOnline, GAME_SPEECH_RATE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const completeRound = useCallback(
    async (finalWrongAttempts: number) => {
      const timeUsedMs = Date.now() - playStartedAt;
      // Awaited, not fire-and-forget: logEvent writes to Dexie before
      // mirroring into gameStore.sessionEvents (lib/engine/telemetry.ts),
      // and keepGoing/finishSession read sessionEvents synchronously to
      // feed the difficulty ML model. Without this await, finishing a
      // session before that write lands would silently drop this round
      // from what the model sees.
      if (currentPatient) {
        await logEvent({
          sessionId: activeSession?.id ?? '',
          patientId: currentPatient.id,
          gameType: 'memory_match',
          difficultyLevel: difficulty.currentLevel,
          roundNumber: round,
          isCorrect: finalWrongAttempts === 0,
          responseTimeMs: timeUsedMs,
          eventTimestamp: new Date().toISOString(),
          metadata: { pairs: level.pairs, wrongAttempts: finalWrongAttempts },
        });
      }
      setPhase('round_complete');
    },
    [playStartedAt, currentPatient, activeSession, difficulty.currentLevel, round, level.pairs],
  );

  const startPlaying = () => {
    setTiles(buildTiles(level.pairs));
    setFaceUpIndices([]);
    setInputLocked(false);
    setMatchedCount(0);
    setWrongAttempts(0);
    setPlayStartedAt(Date.now());
    setPhase('playing');
  };

  const onTileSelect = useCallback(
    (index: number) => {
      if (inputLocked || tiles[index]?.matched || faceUpIndices.includes(index)) return;

      if (faceUpIndices.length === 0) {
        setFaceUpIndices([index]);
        return;
      }

      const first = faceUpIndices[0];
      const next = [first, index];
      setFaceUpIndices(next);
      setInputLocked(true);

      if (tiles[first].pairId === tiles[index].pairId) {
        speak(t('game.memoryMatch.goodMatch'), language, GAME_SPEECH_RATE);
        setTimeout(() => {
          setTiles((prev) => prev.map((tl, i) => (i === first || i === index ? { ...tl, matched: true } : tl)));
          setFaceUpIndices([]);
          setInputLocked(false);
          setMatchedCount((c) => {
            const nextCount = c + 1;
            if (nextCount === level.pairs) {
              setWrongAttempts((w) => {
                void completeRound(w);
                return w;
              });
            }
            return nextCount;
          });
        }, MATCH_DELAY_MS);
      } else {
        speak(t('game.memoryMatch.tryAnotherOne'), language, GAME_SPEECH_RATE);
        setWrongAttempts((w) => w + 1);
        setTimeout(() => {
          setFaceUpIndices([]);
          setInputLocked(false);
        }, MISMATCH_DELAY_MS);
      }
    },
    [inputLocked, tiles, faceUpIndices, level.pairs, completeRound, t, language],
  );

  const score = level.pairs / (level.pairs + wrongAttempts);
  const stars = starsFromRate(score);

  const keepGoing = () => {
    const next = adjustDifficulty(difficulty, 'memory_match', score * 100, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'memory_match', next.currentLevel);
    }
    setRound((r) => r + 1);
    setPhase('instruction');
  };

  const finishSession = () => {
    const next = adjustDifficulty(difficulty, 'memory_match', score * 100, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'memory_match', next.currentLevel);
    }
    setPhase('session_complete');
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'memory_match');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.memoryMatch.name')}
        onBack={() => {
          void endSession();
          router.push('/app');
        }}
      />

      <main className="flex flex-1 flex-col items-center gap-4 px-4 py-6">
        {phase === 'instruction' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink">{t('game.memoryMatch.instruction')}</p>
            <BigButton label={t('game.start')} variant="primary" onClick={startPlaying} />
          </div>
        ) : null}

        {phase === 'playing' ? (
          <div className="flex w-full flex-1 flex-col items-center gap-4">
            <p data-testid="memory-match-progress" className="text-patient-body text-ink">
              {t('game.memoryMatch.progress', { count: matchedCount, total: level.pairs })}
            </p>
            <MemoryGrid
              tiles={tiles}
              faceUpIndices={faceUpIndices}
              onTileSelect={onTileSelect}
              inputLocked={inputLocked}
            />
          </div>
        ) : null}

        {phase === 'round_complete' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-4xl text-primary" aria-hidden="true">
              {'★'.repeat(stars)}
              {'☆'.repeat(5 - stars)}
            </p>
            <p className="font-serif-display text-patient-heading text-ink">
              {t('game.memoryMatch.done', { total: level.pairs })}
            </p>
            <BigButton label={t('game.anotherRound')} variant="primary" onClick={keepGoing} />
            <BigButton label={t('game.finishSession')} variant="secondary" onClick={finishSession} />
          </div>
        ) : null}

        {phase === 'session_complete' ? (
          <SessionComplete
            gameType="memory_match"
            stars={stars}
            correctCount={level.pairs}
            totalCount={level.pairs}
            onGoHome={goHome}
          />
        ) : null}
      </main>
    </div>
  );
}
