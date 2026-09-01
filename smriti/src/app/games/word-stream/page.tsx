'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import PatientNav from '@/components/layout/PatientNav';
import SessionComplete from '@/components/games/SessionComplete';
import { OBJECTS, pickObjects, type SmritiObject } from '@/lib/engine/objects';
import { logEvent } from '@/lib/engine/telemetry';
import { scoreRecall, starsFromRate, type RecallScore } from '@/lib/engine/scoring';
import { speak } from '@/lib/audio/speech';
import { useTranslation } from '@/lib/i18n/provider';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

const ITEM_COUNT_BY_LEVEL: Record<number, number> = { 1: 3, 2: 3, 3: 4, 4: 4, 5: 5, 6: 5 };
const GRID_TOTAL_BY_LEVEL: Record<number, number> = { 1: 8, 2: 8, 3: 10, 4: 10, 5: 12, 6: 12 };
const SHOW_SECONDS = 3;

function objectFor(id: string): SmritiObject {
  return OBJECTS.find((o) => o.id === id) ?? OBJECTS[0];
}

export default function WordStreamPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const wordStreamItems = useGameStore((s) => s.wordStreamItems);
  const setWordStreamItems = useGameStore((s) => s.setWordStreamItems);
  const activeSession = useGameStore((s) => s.activeSession);
  const isSessionActive = useGameStore((s) => s.isSessionActive);

  const level = currentPatient?.currentDifficulty.word_stream ?? 1;
  const isRecall = wordStreamItems.length > 0;

  // --- START phase ---
  const [showIndex, setShowIndex] = useState(0);
  const [startItems, setStartItems] = useState<SmritiObject[]>([]);
  const [startDone, setStartDone] = useState(false);

  useEffect(() => {
    if (isRecall) return;
    const items = pickObjects(ITEM_COUNT_BY_LEVEL[level] ?? 3);
    queueMicrotask(() => {
      setStartItems(items);
      setShowIndex(0);
      setStartDone(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecall]);

  useEffect(() => {
    if (isRecall || startItems.length === 0) return;
    if (showIndex >= startItems.length) {
      queueMicrotask(() => setStartDone(true));
      return;
    }
    speak(startItems[showIndex].name.en);
    const timer = setTimeout(() => setShowIndex((i) => i + 1), SHOW_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [isRecall, startItems, showIndex]);

  const confirmRemembered = () => {
    setWordStreamItems(startItems.map((o) => o.id));
    router.push('/');
  };

  // --- RECALL phase ---
  const [gridItems, setGridItems] = useState<SmritiObject[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<RecallScore | null>(null);

  useEffect(() => {
    if (!isRecall) return;
    speak('Which items did we show you?');
    const total = GRID_TOTAL_BY_LEVEL[level] ?? 8;
    const distractors = pickObjects(total - wordStreamItems.length, wordStreamItems);
    const all = [...wordStreamItems.map(objectFor), ...distractors];
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
  }, [isRecall]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finishRecall = async () => {
    const score = scoreRecall(wordStreamItems, selected);
    setResult(score);

    if (currentPatient) {
      await logEvent({
        sessionId: activeSession?.id ?? '',
        patientId: currentPatient.id,
        gameType: 'word_stream',
        difficultyLevel: level,
        roundNumber: 1,
        isCorrect: score.misses === 0 && score.falseAlarms === 0,
        responseTimeMs: null,
        eventTimestamp: new Date().toISOString(),
        metadata: { ...score, original: wordStreamItems, selected: [...selected] },
      });
    }
  };

  const goHome = () => {
    // Cleared here, not at finishRecall: clearing earlier would flip
    // `isRecall` back to false while the result screen is still showing,
    // re-triggering the START effect underneath it.
    setWordStreamItems([]);
    router.push('/');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav
        title={t('game.wordStream.name')}
        onBack={isSessionActive ? undefined : () => router.push('/')}
      />

      <main className="flex flex-1 flex-col items-center gap-6 px-4 py-6">
        {!isRecall && !startDone ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink">{t('game.wordStream.instruction')}</p>
            {startItems[showIndex] ? (
              <>
                <span className="text-6xl" aria-hidden="true">
                  {startItems[showIndex].emoji}
                </span>
                <span className="text-patient-heading font-semibold text-ink">
                  {startItems[showIndex].name.en}
                </span>
              </>
            ) : null}
          </div>
        ) : null}

        {!isRecall && startDone ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-patient-body text-ink">Remember these for later.</p>
            <BigButton label="OK, I remember!" variant="primary" onClick={confirmRemembered} />
          </div>
        ) : null}

        {isRecall && !result ? (
          <div className="flex flex-1 flex-col items-center gap-4">
            <p className="text-patient-body text-ink">Which items did we show you?</p>
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
                      'flex flex-col items-center gap-1 rounded-card border-2 p-3 transition-colors ' +
                      (isSelected
                        ? 'border-success bg-success/10'
                        : 'border-surface-muted bg-surface-card')
                    }
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {obj.emoji}
                    </span>
                    <span className="text-patient-sm text-ink">{obj.name.en}</span>
                  </button>
                );
              })}
            </div>
            <BigButton label="I am done!" variant="primary" onClick={finishRecall} />
          </div>
        ) : null}

        {isRecall && result ? (
          <SessionComplete
            gameType="word_stream"
            stars={starsFromRate(
              result.hits / (wordStreamItems.length || result.hits + result.misses || 1),
            )}
            correctCount={result.hits}
            totalCount={wordStreamItems.length || result.hits + result.misses}
            onGoHome={goHome}
          />
        ) : null}
      </main>
    </div>
  );
}
