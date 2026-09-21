'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import BigButton from '@/components/ui/BigButton';
import PatientNav from '@/components/layout/PatientNav';
import ObjectGrid from '@/components/games/ObjectGrid';
import SessionComplete from '@/components/games/SessionComplete';
import { objectName, type SmritiObject } from '@/lib/engine/objects';
import { useDifficulty } from '@/hooks/useDifficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { speak, GAME_SPEECH_RATE } from '@/lib/audio/speech';
import { narrate } from '@/lib/audio/narrate';
import { useTranslation } from '@/lib/i18n/provider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { LEVELS, RECENT_ROUNDS, buildRound, loadRecentObjectIds, saveRecentObjectIds } from '@/lib/games/objectHuntRound';
import { TUTORIAL_AUTO_SHOW_LIMIT, claimAutoTutorial, tutorialShownCount } from '@/lib/games/tutorialExposure';
import { slower } from '@/lib/games/pacing';

type Phase = 'instruction' | 'reveal' | 'recall' | 'round_complete' | 'session_complete';

/**
 * How long the picture being asked about is shown on its own, before the
 * grid comes back without it. Issue #4: the picture stayed on screen above
 * the grid the whole time, so the patient could match by looking instead
 * of remembering — Memory Blocks hides its pattern the same way. Slowed a
 * further 20% (pacing.SLOWDOWN) per clinical feedback.
 */
const PROMPT_MS = slower(2000);
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

  const patientId = currentPatient?.id;
  // The how-to-play screen is for a patient's first few visits only (see
  // tutorialExposure.ts). After that the game goes straight to the pictures
  // instead of holding every visit behind it. With no patient loaded it is
  // always shown, as before.
  const [phase, setPhase] = useState<Phase>(() =>
    patientId && tutorialShownCount(patientId, 'object_hunt') >= TUTORIAL_AUTO_SHOW_LIMIT ? 'reveal' : 'instruction',
  );
  /** The patient this visit's start screen was counted for (see tutorialExposure.ts). */
  const instructionClaimedForRef = useRef<string | null>(null);
  const { state: difficulty, applySession } = useDifficulty('object_hunt');
  const [round, setRound] = useState(1);
  const [tiles, setTiles] = useState<(SmritiObject | null)[]>([]);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  /** Which picture of the round is being shown (0-based), for the "Picture 2 of 4" line. */
  const [revealPos, setRevealPos] = useState(0);
  /** Object ids of the last rounds, newest last; null until first read from storage. */
  const recentRef = useRef<string[][] | null>(null);
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

  // Counted once per patient, however often this effect re-runs. Only the
  // count follows the patient: a round already in progress is left alone.
  useEffect(() => {
    if (phase !== 'instruction' || !patientId || instructionClaimedForRef.current === patientId) return;
    instructionClaimedForRef.current = patientId;
    claimAutoTutorial(patientId, 'object_hunt');
  }, [phase, patientId]);

  useEffect(() => {
    if (phase !== 'instruction') return;
    void narrate(t('game.objectHunt.instruction'), language, isOnline, GAME_SPEECH_RATE);
    // Patient-paced, like every other game's start screen: no timer runs out
    // under someone still reading, and the wait is never mistaken for a hang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'reveal') return;

    // Pictures from the last couple of rounds (this visit and earlier ones)
    // are kept out, and the reveal and the questions each get their own
    // random order — see objectHuntRound.ts.
    const recent = recentRef.current ?? loadRecentObjectIds(patientId);
    const round = buildRound(level, recent.flat());
    recentRef.current = [...recent, round.revealOrder.map((p) => p.object.id)].slice(-RECENT_ROUNDS);
    saveRecentObjectIds(patientId, recentRef.current);
    const placed = round.tiles;
    const order = round.revealOrder;
    const asked = round.recallOrder;

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
      setTargetOrder(asked);
      setRevealPos(0);
      setTargetPos(0);
      setCorrectCount(0);
      setRevealedIndex(order[0]?.index ?? -1);
      speak(order[0] ? objectName(order[0].object, language) : '', language, GAME_SPEECH_RATE);

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
        setRevealPos(i);
        setRevealedIndex(order[i].index);
        speak(objectName(order[i].object, language), language, GAME_SPEECH_RATE);
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
      if (target) speak(`${t('game.objectHunt.whereWasThe')} ${objectName(target.object, language)}?`, language, GAME_SPEECH_RATE);
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
    speak(isCorrect ? t('game.correct') : t('game.tryAgain'), language, GAME_SPEECH_RATE);
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
    void applySession(accuracy);
    setRound((r) => r + 1);
    setPhase('reveal');
  };

  const finishSession = () => {
    void applySession(accuracy);
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
    <div className="mx-auto flex min-h-dvh w-full max-w-patient flex-col">
      <PatientNav
        title={t('game.objectHunt.name')}
        onBack={() => {
          void endSession();
          router.push('/app');
        }}
      />

      <main className="flex flex-1 flex-col items-center gap-6 px-4 py-6">
        {phase === 'instruction' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <p className="text-patient-body text-ink">{t('game.objectHunt.instruction')}</p>
            <BigButton label={t('game.start')} variant="primary" onClick={() => setPhase('reveal')} />
          </div>
        ) : null}

        {phase === 'recall' && prompting && currentTarget ? (
          <div data-testid="object-hunt-prompt" className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink-muted">{t('game.objectHunt.rememberThis')}</p>
            <div
              className="flex h-40 w-40 items-center justify-center rounded-card border-2 border-line200"
              style={{ backgroundColor: `${currentTarget.object.categoryColor}1A` }}
            >
              <span data-scalable-icon className="text-[96px] leading-none" aria-hidden="true">
                {currentTarget.object.emoji}
              </span>
            </div>
            <p className="font-serif-display text-patient-heading text-ink">
              {objectName(currentTarget.object, language)}
            </p>
          </div>
        ) : null}

        {phase === 'reveal' && targetOrder.length > 0 ? (
          <p data-testid="object-hunt-progress" className="text-patient-body text-ink-muted">
            {t('game.quickTap.itemOf', { n: revealPos + 1, total: targetOrder.length })}
          </p>
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
