'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import BigButton from '@/components/ui/BigButton';
import PatientNav from '@/components/layout/PatientNav';
import ObjectGrid from '@/components/games/ObjectGrid';
import SessionComplete from '@/components/games/SessionComplete';
import { pickObjects, objectName, type SmritiObject } from '@/lib/engine/objects';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { speak } from '@/lib/audio/speech';
import { narrate } from '@/lib/audio/narrate';
import { useTranslation } from '@/lib/i18n/provider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
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
/**
 * How long the picture being asked about is shown on its own, before the
 * grid comes back without it. Issue #4: the picture stayed on screen above
 * the grid the whole time, so the patient could match by looking instead
 * of remembering — Memory Blocks hides its pattern the same way.
 */
const PROMPT_MS = 2000;
/**
 * Several lines per star tier instead of one fixed line each — a round that
 * scores the same star count every time (common once a patient masters a
 * level) used to repeat the exact same sentence every single round.
 */
const ENCOURAGEMENT_VARIANTS = 3;

function starsFor(accuracy: number): number {
  return Math.max(1, Math.round(accuracy / 20));
}

/** An i18n key (game.encourage.<stars>.<variant>) for one of the lines for this star count. */
function pickEncouragement(stars: number): string {
  const tier = Math.max(1, Math.min(5, stars));
  return `game.encourage.${tier}.${Math.floor(Math.random() * ENCOURAGEMENT_VARIANTS)}`;
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
  return (
    <ErrorBoundary>
      <ObjectHuntPageInner />
    </ErrorBoundary>
  );
}

function ObjectHuntPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const currentPatient = usePatientStore((s) => s.currentPatient);
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
  /** True while the target picture is shown alone, before the grid returns. */
  const [prompting, setPrompting] = useState(false);
  // Blocks a second tap while one answer is still being settled. Without it
  // a double tap answered the same target twice and skipped the next one.
  const answeringRef = useRef(false);

  const level = LEVELS[difficulty.currentLevel] ?? LEVELS[1];
  const totalTiles = level.rows * level.cols;

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // Only run once, when the page mounts with a real patient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'instruction') return;
    void narrate(t('game.objectHunt.instruction'), language, isOnline);
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
    let interval: ReturnType<typeof setInterval> | undefined;
    let advanceTimer: ReturnType<typeof setTimeout> | undefined;
    // Set on cleanup so a microtask/interval tick still pending when the
    // phase changes or this page unmounts never touches state or narration
    // again — otherwise it fires detached from React entirely and keeps
    // reading object names over whatever screen comes next.
    let cancelled = false;

    // Deferred one microtask: this effect derives fresh round state from a
    // phase change rather than syncing with an external system, so the lint
    // rule wants it out of the effect's synchronous body.
    queueMicrotask(() => {
      if (cancelled) return;
      setTiles(placed);
      setTargetOrder(order);
      setTargetPos(0);
      setCorrectCount(0);
      setRevealedIndex(order[0]?.index ?? -1);
      speak(order[0] ? objectName(order[0].object, language) : '', language);

      interval = setInterval(() => {
        if (cancelled) return;
        i += 1;
        if (i >= order.length) {
          clearInterval(interval);
          advanceTimer = setTimeout(() => {
            if (!cancelled) setPhase('recall');
          }, 500);
          return;
        }
        setRevealedIndex(order[i].index);
        speak(objectName(order[i].object, language), language);
      }, level.revealSeconds * 1000);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (advanceTimer) clearTimeout(advanceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'recall') return;
    const target = targetOrder[targetPos];
    let cancelled = false;
    let promptTimer: ReturnType<typeof setTimeout> | undefined;
    queueMicrotask(() => {
      if (cancelled) return;
      setRevealedIndex(-1);
      setPrompting(true);
      answeringRef.current = false;
      if (target) speak(`${t('game.objectHunt.whereWasThe')} ${objectName(target.object, language)}?`, language);
      promptTimer = setTimeout(() => {
        if (cancelled) return;
        setPrompting(false);
        setRoundStartedAt(Date.now());
      }, PROMPT_MS);
    });
    return () => {
      cancelled = true;
      if (promptTimer) clearTimeout(promptTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, targetPos]);

  const currentTarget = targetOrder[targetPos];

  const onTileSelect = async (index: number) => {
    // A missing patient profile used to return here too, which silently
    // ignored every tap on devices without one loaded (issue #4: "choosing
    // the box is not working"). Only the logging below needs a patient.
    if (!currentTarget || prompting || answeringRef.current) return;
    answeringRef.current = true;

    const isCorrect = index === currentTarget.index;
    const responseTimeMs = Date.now() - roundStartedAt;

    setFlash({ index: isCorrect ? currentTarget.index : index, correct: isCorrect });
    speak(isCorrect ? t('game.correct') : t('game.tryAgain'), language);
    if (isCorrect) setCorrectCount((c) => c + 1);

    if (currentPatient) {
      try {
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
      } catch (err) {
        // A failed local write (e.g. IndexedDB blocked on the device) must
        // never freeze the game on this target.
        console.error('SMRITI: object hunt event not saved', err);
      }
    }

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
  // Recomputed once per round (not on every re-render) so the line doesn't
  // change under the patient's eyes while a single "round complete" screen
  // is still showing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const encouragement = useMemo(() => pickEncouragement(stars), [round, stars]);

  const keepGoing = () => {
    const next = adjustDifficulty(difficulty, 'object_hunt', accuracy, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
    if (currentPatient) void usePatientStore.getState().updateDifficulty(currentPatient.id, 'object_hunt', next.currentLevel);
    setRound((r) => r + 1);
    setPhase('reveal');
  };

  const finishSession = () => {
    const next = adjustDifficulty(difficulty, 'object_hunt', accuracy, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
    if (currentPatient) void usePatientStore.getState().updateDifficulty(currentPatient.id, 'object_hunt', next.currentLevel);
    setPhase('session_complete');
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'object_hunt');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.objectHunt.name')}
        onBack={() => {
          void endSession();
          router.push('/app');
        }}
      />

      <main className="flex flex-1 flex-col items-center gap-6 px-4 py-6">
        {phase === 'instruction' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink">{t('game.objectHunt.instruction')}</p>
            <div className="h-16 w-16 animate-pulse rounded-card bg-primary/30 motion-reduce:animate-none" />
          </div>
        ) : null}

        {phase === 'recall' && prompting && currentTarget ? (
          <div data-testid="object-hunt-prompt" className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink-muted">{t('game.objectHunt.rememberThis')}</p>
            <div
              className="flex h-40 w-40 items-center justify-center rounded-card border-2 border-line200"
              style={{ backgroundColor: `${currentTarget.object.categoryColor}1A` }}
            >
              <span className="text-[96px] leading-none" aria-hidden="true">
                {currentTarget.object.emoji}
              </span>
            </div>
            <p className="font-serif-display text-patient-heading text-ink">
              {objectName(currentTarget.object, language)}
            </p>
          </div>
        ) : null}

        {(phase === 'reveal' || (phase === 'recall' && !prompting)) && currentTarget ? (
          <ObjectGrid
            objects={tiles}
            totalTiles={totalTiles}
            onTileSelect={onTileSelect}
            revealState={phase}
            revealedTileIndex={revealedIndex}
            correctTileIndex={currentTarget.index}
            targetObject={currentTarget.object}
            targetLabel={`${t('game.objectHunt.whereWasThe')} ${objectName(currentTarget.object, language)}?`}
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
            <p className="font-serif-display text-patient-heading text-ink">
              {t('game.outOfCorrect', { count: correctCount, total: targetOrder.length })}
            </p>
            <p className="text-patient-body text-ink-muted">{t(encouragement)}</p>
            <BigButton label={t('game.keepGoing')} variant="primary" onClick={keepGoing} />
            <BigButton label={t('game.finishSession')} variant="secondary" onClick={finishSession} />
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
