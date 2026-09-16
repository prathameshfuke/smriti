'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import BigButton from '@/components/ui/BigButton';
import PatientNav from '@/components/layout/PatientNav';
import SessionComplete from '@/components/games/SessionComplete';
import GameTutorial, { TUTORIALS } from '@/components/games/GameTutorial';
import { pickObjects, objectName, type SmritiObject } from '@/lib/engine/objects';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { penalizedAccuracy, scoreQuickTapRound, starsFromRate } from '@/lib/engine/scoring';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { narrate } from '@/lib/audio/narrate';
import { GAME_SPEECH_RATE } from '@/lib/audio/speech';
import { useTranslation } from '@/lib/i18n/provider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { quickTapFaster } from '@/lib/games/pacing';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

type Phase = 'instruction' | 'playing' | 'round_complete' | 'session_complete';

interface LevelParams {
  displayMs: number;
  itemCount: number;
  targetPct: number;
}

/** Display speed, round length and target frequency, per the RVP/Double Decision table.
 * Display time is sped up ~10% (clinical feedback: this game felt sluggish) via
 * `quickTapFaster` — the sole exception to every other game's slow-down. */
const LEVELS: Record<number, LevelParams> = {
  1: { displayMs: quickTapFaster(2000), itemCount: 15, targetPct: 0.4 },
  2: { displayMs: quickTapFaster(1500), itemCount: 15, targetPct: 0.4 },
  3: { displayMs: quickTapFaster(1500), itemCount: 20, targetPct: 0.35 },
  4: { displayMs: quickTapFaster(1200), itemCount: 20, targetPct: 0.35 },
  5: { displayMs: quickTapFaster(1000), itemCount: 25, targetPct: 0.3 },
  6: { displayMs: quickTapFaster(800), itemCount: 25, targetPct: 0.3 },
  7: { displayMs: quickTapFaster(600), itemCount: 30, targetPct: 0.25 },
  8: { displayMs: quickTapFaster(500), itemCount: 30, targetPct: 0.25 },
};

interface SequenceItem {
  object: SmritiObject;
  isTarget: boolean;
  tapped: boolean;
}

/** Mixes target/non-target items to the level's target percentage. */
function generateSequence(target: SmritiObject, params: LevelParams): SequenceItem[] {
  const targetCount = Math.round(params.itemCount * params.targetPct);
  const nonTargetCount = params.itemCount - targetCount;
  const distractors = pickObjects(nonTargetCount, [target.id]);

  const items: SequenceItem[] = [
    ...Array.from({ length: targetCount }, () => ({ object: target, isTarget: true, tapped: false })),
    ...Array.from({ length: nonTargetCount }, (_, i) => ({
      object: distractors[i % Math.max(1, distractors.length)] ?? target,
      isTarget: false,
      tapped: false,
    })),
  ];

  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export default function QuickTapPage() {
  return (
    <ErrorBoundary>
      <QuickTapPageInner />
    </ErrorBoundary>
  );
}

function QuickTapPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);
  const activeSession = useGameStore((s) => s.activeSession);

  const [phase, setPhase] = useState<Phase>('instruction');
  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.quick_tap ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));
  const [round, setRound] = useState(1);
  const [target, setTarget] = useState<SmritiObject | null>(null);
  const [sequence, setSequence] = useState<SequenceItem[]>([]);
  const [itemIndex, setItemIndex] = useState(0);
  const [ring, setRing] = useState<'hit' | 'false_alarm' | null>(null);

  // Per-item timers/handled-flags: a late timeout must never re-resolve an
  // item a tap already settled, and every timer needs clearing on unmount.
  const handledRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const level = LEVELS[difficulty.currentLevel] ?? LEVELS[1];

  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'instruction') return;
    void narrate(t('game.quickTap.instruction'), language, isOnline, GAME_SPEECH_RATE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const startRound = () => {
    if (!target) return;
    const seq = generateSequence(target, level);
    setSequence(seq);
    setItemIndex(0);
    setPhase('playing');
  };

  useEffect(() => {
    if (phase !== 'instruction') return;
    queueMicrotask(() => setTarget(pickObjects(1)[0] ?? null));
  }, [phase, round]);

  // logEvent writes to Dexie before mirroring into gameStore.sessionEvents
  // (lib/engine/telemetry.ts). Unlike other games, this one calls it once
  // PER SEQUENCE ITEM (up to 30 per round, not once per round) — keepGoing/
  // finishSession read sessionEvents once the whole round ends, so every
  // item's log must land, not just the round's last one. Returns a promise
  // so both call sites can sequence their own next step (advancing
  // itemIndex) after the write actually completes, closing the same race
  // fixed in path-match/memory-match, at every item instead of once.
  const logRoundItem = async (index: number, tapped: boolean): Promise<void> => {
    setSequence((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], tapped };
      return next;
    });

    if (!currentPatient) return;
    const item = sequence[index];
    if (!item) return;
    const isHit = item.isTarget && tapped;
    const isFalseAlarm = !item.isTarget && tapped;

    try {
      await logEvent({
        sessionId: activeSession?.id ?? '',
        patientId: currentPatient.id,
        gameType: 'quick_tap',
        difficultyLevel: difficulty.currentLevel,
        roundNumber: round,
        isCorrect: isHit,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { objectId: item.object.id, isTarget: item.isTarget, tapped, isFalseAlarm },
      });
    } catch (err) {
      // Callers advance to the next item only after this resolves; a
      // rejected write must not freeze the round on one picture.
      console.error('SMRITI: quick tap event not saved', err);
    }
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    if (itemIndex >= sequence.length) {
      queueMicrotask(() => setPhase('round_complete'));
      return;
    }

    handledRef.current = false;
    const timer = setTimeout(() => {
      if (handledRef.current) return;
      handledRef.current = true;
      void logRoundItem(itemIndex, false).then(() => setItemIndex((i) => i + 1));
    }, level.displayMs);
    timersRef.current.push(timer);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, itemIndex, sequence.length]);

  const onScreenTap = () => {
    if (phase !== 'playing' || handledRef.current) return;
    handledRef.current = true;

    const item = sequence[itemIndex];
    if (!item) return;

    void logRoundItem(itemIndex, true).then(() => {
      setRing(item.isTarget ? 'hit' : 'false_alarm');
      const timer = setTimeout(() => {
        setRing(null);
        setItemIndex((i) => i + 1);
      }, 250);
      timersRef.current.push(timer);
    });
  };

  const currentItem = sequence[itemIndex];

  const summary = scoreQuickTapRound(sequence.map((s) => ({ isTarget: s.isTarget, tapped: s.tapped })));
  const totalTargets = sequence.filter((s) => s.isTarget).length;
  // Wrong taps (false alarms) take points back, so tapping every picture
  // no longer scores full marks (issue #4).
  const hitRate = penalizedAccuracy(summary.hits, summary.falseAlarms, totalTargets);
  const stars = starsFromRate(hitRate);

  const keepGoing = () => {
    const next = adjustDifficulty(difficulty, 'quick_tap', hitRate * 100, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'quick_tap', next.currentLevel);
    }
    setRound((r) => r + 1);
    setPhase('instruction');
  };

  const finishSession = () => {
    const next = adjustDifficulty(difficulty, 'quick_tap', hitRate * 100, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'quick_tap', next.currentLevel);
    }
    setPhase('session_complete');
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'quick_tap');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.quickTap.name')}
        onBack={() => {
          void endSession();
          router.push('/app');
        }}
      />

      <main className="flex flex-1 flex-col items-center gap-4 px-4 py-6">
        {phase === 'instruction' && target ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink-muted">{t('game.quickTap.targetIs')}</p>
            <span data-scalable-icon className="text-[96px] leading-none" aria-hidden="true">
              {target.emoji}
            </span>
            <p className="font-serif-display text-patient-heading text-ink">{objectName(target, language)}</p>
            <BigButton label={t('game.start')} variant="primary" onClick={startRound} />
            <GameTutorial gameId="quick_tap" steps={TUTORIALS.quick_tap} onReady={startRound} />
          </div>
        ) : null}

        {phase === 'playing' ? (
          <div className="flex w-full flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-patient-sm text-ink-muted">
                {t('game.quickTap.itemOf', { n: Math.min(itemIndex + 1, sequence.length), total: sequence.length })}
              </p>
              {target ? (
                <span data-scalable-icon className="shrink-0 text-[48px] leading-none" aria-hidden="true">
                  {target.emoji}
                </span>
              ) : null}
            </div>

            <div
              role="button"
              tabIndex={0}
              onPointerDown={onScreenTap}
              className="flex flex-1 items-center justify-center"
            >
              {currentItem ? (
                <div
                  className={
                    'flex h-[140px] w-[140px] items-center justify-center rounded-card bg-game-tile text-6xl transition-shadow ' +
                    (ring === 'hit'
                      ? 'ring-4 ring-success'
                      : ring === 'false_alarm'
                        ? 'ring-4 ring-warning'
                        : '')
                  }
                >
                  <span aria-hidden="true">{currentItem.object.emoji}</span>
                </div>
              ) : null}
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
              {t('game.quickTap.hits', { count: summary.hits })}
            </p>
            <p className="text-patient-body text-ink-muted" data-testid="quick-tap-extra">
              {t('game.extraTaps', { count: summary.falseAlarms })}
            </p>
            <BigButton label={t('game.anotherRound')} variant="primary" onClick={keepGoing} />
            <BigButton label={t('game.finishSession')} variant="secondary" onClick={finishSession} />
          </div>
        ) : null}

        {phase === 'session_complete' ? (
          <SessionComplete
            gameType="quick_tap"
            stars={stars}
            correctCount={summary.hits}
            totalCount={totalTargets}
            wrongCount={summary.falseAlarms}
            onGoHome={goHome}
          />
        ) : null}
      </main>
    </div>
  );
}
