'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import PatientNav from '@/components/layout/PatientNav';
import ObjectGrid from '@/components/games/ObjectGrid';
import SessionComplete from '@/components/games/SessionComplete';
import { pickObjects, type SmritiObject } from '@/lib/engine/objects';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { speak } from '@/lib/audio/speech';
import { useTranslation } from '@/lib/i18n/provider';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

type Phase = 'instruction' | 'reveal' | 'recall' | 'round_complete' | 'session_complete';

interface LevelParams {
  rows: number;
  cols: number;
  objectCount: number;
  revealSeconds: number;
}

/** Grid size, object count and per-tile reveal time for each of the 10 levels. */
const LEVELS: Record<number, LevelParams> = {
  1: { rows: 2, cols: 2, objectCount: 2, revealSeconds: 3 },
  2: { rows: 2, cols: 2, objectCount: 3, revealSeconds: 3 },
  3: { rows: 2, cols: 2, objectCount: 4, revealSeconds: 2.5 },
  4: { rows: 2, cols: 3, objectCount: 3, revealSeconds: 2.5 },
  5: { rows: 2, cols: 3, objectCount: 4, revealSeconds: 2 },
  6: { rows: 2, cols: 3, objectCount: 6, revealSeconds: 2 },
  7: { rows: 3, cols: 3, objectCount: 4, revealSeconds: 2 },
  8: { rows: 3, cols: 3, objectCount: 6, revealSeconds: 1.5 },
  9: { rows: 3, cols: 4, objectCount: 6, revealSeconds: 1.5 },
  10: { rows: 3, cols: 4, objectCount: 8, revealSeconds: 1 },
};

const INSTRUCTION_SECONDS = 5;
const ENCOURAGEMENT = [
  '',
  "You're learning! Keep trying.",
  "Good try! You're getting there.",
  'Nice work!',
  'Great job!',
  'Wonderful! You remembered everything!',
];

function starsFor(accuracy: number): number {
  return Math.max(1, Math.round(accuracy / 20));
}

/** Places `objectCount` distinct objects across random tiles in the grid. */
function layoutTiles(objects: SmritiObject[], totalTiles: number): (SmritiObject | null)[] {
  const positions = Array.from({ length: totalTiles }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const tiles: (SmritiObject | null)[] = Array(totalTiles).fill(null);
  objects.forEach((obj, i) => {
    tiles[positions[i]] = obj;
  });
  return tiles;
}

export default function ObjectHuntPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const isSessionActive = useGameStore((s) => s.isSessionActive);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [phase, setPhase] = useState<Phase>('instruction');
  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.object_hunt ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));
  const [round, setRound] = useState(1);
  const [tiles, setTiles] = useState<(SmritiObject | null)[]>([]);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [targetOrder, setTargetOrder] = useState<{ index: number; object: SmritiObject }[]>([]);
  const [targetPos, setTargetPos] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [flash, setFlash] = useState<{ index: number; correct: boolean } | null>(null);
  const [roundStartedAt, setRoundStartedAt] = useState(0);

  const level = LEVELS[difficulty.currentLevel] ?? LEVELS[1];
  const totalTiles = level.rows * level.cols;

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // Only run once, when the page mounts with a real patient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'instruction') return;
    speak(t('game.objectHunt.instruction'));
    const timer = setTimeout(() => setPhase('reveal'), INSTRUCTION_SECONDS * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'reveal') return;

    const objects = pickObjects(level.objectCount);
    const placed = layoutTiles(objects, totalTiles);
    const order = placed
      .map((obj, index) => (obj ? { index, object: obj } : null))
      .filter((v): v is { index: number; object: SmritiObject } => v !== null);

    let i = 0;
    let interval: ReturnType<typeof setInterval>;

    // Deferred one microtask: this effect derives fresh round state from a
    // phase change rather than syncing with an external system, so the lint
    // rule wants it out of the effect's synchronous body.
    queueMicrotask(() => {
      setTiles(placed);
      setTargetOrder(order);
      setTargetPos(0);
      setCorrectCount(0);
      setRevealedIndex(order[0]?.index ?? -1);
      speak(order[0]?.object.name.en ?? '');

      interval = setInterval(() => {
        i += 1;
        if (i >= order.length) {
          clearInterval(interval);
          setTimeout(() => setPhase('recall'), 500);
          return;
        }
        setRevealedIndex(order[i].index);
        speak(order[i].object.name.en);
      }, level.revealSeconds * 1000);
    });

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'recall') return;
    const target = targetOrder[targetPos];
    queueMicrotask(() => {
      setRevealedIndex(-1);
      setRoundStartedAt(Date.now());
      if (target) speak(`Where was the ${target.object.name.en}?`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, targetPos]);

  const currentTarget = targetOrder[targetPos];

  const onTileSelect = async (index: number) => {
    if (!currentTarget || !currentPatient) return;

    const isCorrect = index === currentTarget.index;
    const responseTimeMs = Date.now() - roundStartedAt;

    setFlash({ index: isCorrect ? currentTarget.index : index, correct: isCorrect });
    speak(isCorrect ? t('game.correct') : t('game.tryAgain'));
    if (isCorrect) setCorrectCount((c) => c + 1);

    await logEvent({
      sessionId: activeSession?.id ?? '',
      patientId: currentPatient.id,
      gameType: 'object_hunt',
      difficultyLevel: difficulty.currentLevel,
      roundNumber: round,
      isCorrect,
      responseTimeMs,
      eventTimestamp: new Date().toISOString(),
      metadata: { targetObjectId: currentTarget.object.id, tappedIndex: index },
    });

    const pauseMs = isCorrect ? 1000 : 800;
    setTimeout(() => {
      setFlash(null);
      if (targetPos + 1 >= targetOrder.length) {
        setPhase('round_complete');
      } else {
        setTargetPos((p) => p + 1);
      }
    }, pauseMs);
  };

  const accuracy = targetOrder.length > 0 ? (correctCount / targetOrder.length) * 100 : 0;
  const stars = starsFor(accuracy);

  const keepGoing = () => {
    const next = adjustDifficulty(difficulty, 'object_hunt', accuracy);
    setDifficulty(next);
    if (currentPatient) void usePatientStore.getState().updateDifficulty(currentPatient.id, 'object_hunt', next.currentLevel);
    setRound((r) => r + 1);
    setPhase('reveal');
  };

  const finishSession = () => {
    const next = adjustDifficulty(difficulty, 'object_hunt', accuracy);
    setDifficulty(next);
    if (currentPatient) void usePatientStore.getState().updateDifficulty(currentPatient.id, 'object_hunt', next.currentLevel);
    setPhase('session_complete');
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'object_hunt');
    }
    await endSession();
    router.push('/');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav title={t('game.objectHunt.name')} onBack={isSessionActive ? undefined : () => router.push('/')} />

      <main className="flex flex-1 flex-col items-center gap-6 px-4 py-6">
        {phase === 'instruction' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink">{t('game.objectHunt.instruction')}</p>
            <div className="h-16 w-16 animate-pulse rounded-card bg-primary/30" />
          </div>
        ) : null}

        {(phase === 'reveal' || phase === 'recall') && currentTarget ? (
          <ObjectGrid
            objects={tiles}
            totalTiles={totalTiles}
            onTileSelect={onTileSelect}
            revealState={phase}
            revealedTileIndex={revealedIndex}
            correctTileIndex={currentTarget.index}
            targetObject={currentTarget.object}
            flashIndex={flash?.index}
            flashCorrect={flash?.correct}
          />
        ) : null}

        {phase === 'round_complete' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-4xl text-primary" aria-hidden="true">
              {'★'.repeat(stars)}
              {'☆'.repeat(5 - stars)}
            </p>
            <p className="text-patient-heading text-ink">
              {correctCount} out of {targetOrder.length} correct!
            </p>
            <p className="text-patient-body text-ink-muted">{ENCOURAGEMENT[stars]}</p>
            <BigButton label="Keep Going" variant="primary" onClick={keepGoing} />
            <BigButton label="Finish Session" variant="secondary" onClick={finishSession} />
          </div>
        ) : null}

        {phase === 'session_complete' ? (
          <SessionComplete
            gameType="object_hunt"
            stars={stars}
            correctCount={correctCount}
            totalCount={targetOrder.length}
            onGoHome={goHome}
          />
        ) : null}
      </main>
    </div>
  );
}
