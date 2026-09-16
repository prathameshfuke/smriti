'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import BigButton from '@/components/ui/BigButton';
import PatientNav from '@/components/layout/PatientNav';
import SessionComplete from '@/components/games/SessionComplete';
import { OBJECTS, pickObjects, objectName, type SmritiObject } from '@/lib/engine/objects';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import { buildDailySummary, logEvent } from '@/lib/engine/telemetry';
import { penalizedAccuracy, scoreRecall, starsFromRate, type RecallScore } from '@/lib/engine/scoring';
import { speak } from '@/lib/audio/speech';
import { narrate } from '@/lib/audio/narrate';
import { useTranslation } from '@/lib/i18n/provider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

const ITEM_COUNT_BY_LEVEL: Record<number, number> = { 1: 3, 2: 3, 3: 4, 4: 4, 5: 5, 6: 5 };
const GRID_TOTAL_BY_LEVEL: Record<number, number> = { 1: 8, 2: 8, 3: 10, 4: 10, 5: 12, 6: 12 };
const SHOW_SECONDS = 3;
/** Filled pause between memorizing and recall — long enough to be a real
 * delayed-recall test, short enough not to feel like the game stalled. */
const DELAY_SECONDS = 12;

type Phase = 'show' | 'delay' | 'recall' | 'result';

function objectFor(id: string): SmritiObject {
  return OBJECTS.find((o) => o.id === id) ?? OBJECTS[0];
}

export default function WordStreamPage() {
  return (
    <ErrorBoundary>
      <WordStreamPageInner />
    </ErrorBoundary>
  );
}

function WordStreamPageInner() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const activeSession = useGameStore((s) => s.activeSession);
  const startSession = useGameStore((s) => s.startSession);
  const endSession = useGameStore((s) => s.endSession);

  // One continuous visit per round: show the items, hold a filled pause
  // (the actual delayed-recall interval), then test recall — all without
  // ever leaving this page. An earlier version sent the patient back to
  // the home screen after the show phase and relied on them remembering to
  // reopen this same tile for the recall half; for this cohort that reads
  // as the game randomly quitting, and most patients never came back to
  // finish the round at all.
  useEffect(() => {
    if (currentPatient) startSession(currentPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [difficulty, setDifficulty] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty.word_stream ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));
  const level = difficulty.currentLevel;

  const [phase, setPhase] = useState<Phase>('show');
  const [itemsToRecall, setItemsToRecall] = useState<string[]>([]);

  // --- SHOW phase ---
  const [showIndex, setShowIndex] = useState(0);
  const [startItems, setStartItems] = useState<SmritiObject[]>([]);

  useEffect(() => {
    const items = pickObjects(ITEM_COUNT_BY_LEVEL[level] ?? 3);
    queueMicrotask(() => {
      setStartItems(items);
      setShowIndex(0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'show' || startItems.length === 0) return;
    if (showIndex >= startItems.length) {
      setItemsToRecall(startItems.map((o) => o.id));
      setPhase('delay');
      return;
    }
    speak(objectName(startItems[showIndex], language), language);
    const timer = setTimeout(() => setShowIndex((i) => i + 1), SHOW_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [phase, startItems, showIndex, language]);

  // --- DELAY phase — a filled pause, not a trip back to the home screen ---
  const [delayRemaining, setDelayRemaining] = useState(DELAY_SECONDS);

  useEffect(() => {
    if (phase !== 'delay') return;
    setDelayRemaining(DELAY_SECONDS);
    void narrate(t('game.wordStream.rememberLater'), language, isOnline);
    const interval = setInterval(() => {
      setDelayRemaining((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setPhase('recall');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // --- RECALL phase ---
  const [gridItems, setGridItems] = useState<SmritiObject[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<RecallScore | null>(null);

  useEffect(() => {
    if (phase !== 'recall') return;
    void narrate(t('game.wordStream.whichItems'), language, isOnline);
    const total = GRID_TOTAL_BY_LEVEL[level] ?? 8;
    const distractors = pickObjects(total - itemsToRecall.length, itemsToRecall);
    const all = [...itemsToRecall.map(objectFor), ...distractors];
    for (let i = all.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    queueMicrotask(() => {
      setGridItems(all);
      setSelected(new Set());
      setResult(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finishRecall = async () => {
    const score = scoreRecall(itemsToRecall, selected);
    setResult(score);
    setPhase('result');

    const total = itemsToRecall.length || score.hits + score.misses || 1;
    const accuracy = penalizedAccuracy(score.hits, score.falseAlarms, total) * 100;
    const next = adjustDifficulty(difficulty, 'word_stream', accuracy, useGameStore.getState().sessionEvents);
    setDifficulty(next);
    if (currentPatient) {
      // SAFE-FIRE-AND-FORGET: only read by a future session's mount (real navigation time apart), not within this session — lower severity than the logEvent bug class this mirrors the shape of, not urgently fixed but made visible
      void usePatientStore.getState().updateDifficulty(currentPatient.id, 'word_stream', next.currentLevel);

      await logEvent({
        sessionId: activeSession?.id ?? '',
        patientId: currentPatient.id,
        gameType: 'word_stream',
        difficultyLevel: level,
        roundNumber: 1,
        isCorrect: score.misses === 0 && score.falseAlarms === 0,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { ...score, accuracy, original: itemsToRecall, selected: [...selected] },
      });
    }
  };

  const goHome = async () => {
    if (currentPatient) {
      await buildDailySummary(currentPatient.id, new Date().toISOString().slice(0, 10), 'word_stream');
    }
    await endSession();
    router.push('/app');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.wordStream.name')}
        onBack={() => {
          void endSession();
          router.push('/app');
        }}
      />

      <main className="flex flex-1 flex-col items-center gap-6 px-4 py-6">
        {phase === 'show' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink">{t('game.wordStream.instruction')}</p>
            {startItems[showIndex] ? (
              <>
                <span className="text-6xl" aria-hidden="true">
                  {startItems[showIndex].emoji}
                </span>
                <span className="font-serif-display text-patient-heading font-semibold text-ink">
                  {objectName(startItems[showIndex], language)}
                </span>
              </>
            ) : null}
          </div>
        ) : null}

        {phase === 'delay' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink">{t('game.wordStream.rememberLater')}</p>
            <div
              className="flex h-24 w-24 items-center justify-center rounded-card border-2 border-primary/30 bg-surface-card font-serif-display text-patient-heading text-primary"
              role="status"
              aria-live="polite"
            >
              {delayRemaining}
            </div>
          </div>
        ) : null}

        {phase === 'recall' && !result ? (
          <div className="flex flex-1 flex-col items-center gap-4">
            <p className="text-patient-body text-ink">{t('game.wordStream.whichItems')}</p>
            <div className="grid grid-cols-3 gap-3">
              {gridItems.map((obj) => {
                const isSelected = selected.has(obj.id);
                return (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => toggle(obj.id)}
                    aria-pressed={isSelected}
                    className={
                      'flex flex-col items-center gap-1 rounded-card border-2 p-3 transition-all ' +
                      (isSelected
                        ? 'border-success bg-success/10 shadow-md'
                        : 'border-surface-muted bg-surface-card hover:border-primary/30')
                    }
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {obj.emoji}
                    </span>
                    <span className="text-patient-sm text-ink">{objectName(obj, language)}</span>
                  </button>
                );
              })}
            </div>
            <BigButton label={t('game.wordStream.imDone')} variant="primary" onClick={finishRecall} />
          </div>
        ) : null}

        {phase === 'result' && result ? (
          <SessionComplete
            gameType="word_stream"
            stars={starsFromRate(
              penalizedAccuracy(result.hits, result.falseAlarms, itemsToRecall.length || result.hits + result.misses || 1),
            )}
            correctCount={result.hits}
            wrongCount={result.falseAlarms}
            totalCount={itemsToRecall.length || result.hits + result.misses}
            onGoHome={goHome}
          />
        ) : null}
      </main>
    </div>
  );
}
