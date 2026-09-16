'use client';

import { useEffect, useState } from 'react';
import BigButton from '@/components/ui/BigButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { narrate } from '@/lib/audio/narrate';
import { stopAllAudio } from '@/lib/audio/channel';
import { useTranslation } from '@/lib/i18n/provider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';

export interface TutorialStep {
  /** A large emoji "picture" illustrating the step. */
  visual: string;
  /** i18n key for the step's sentence, also read aloud. */
  textKey: string;
}

export interface GameTutorialProps {
  /** Used for the "seen" flag, e.g. "quick_tap". */
  gameId: string;
  steps: TutorialStep[];
}

const seenKey = (gameId: string) => `smriti.tutorialSeen.${gameId}`;

/** True the first time this game is opened on this device. */
function isFirstVisit(gameId: string): boolean {
  try {
    if (window.localStorage.getItem(seenKey(gameId))) return false;
    window.localStorage.setItem(seenKey(gameId), '1');
    return true;
  } catch {
    // Storage blocked: never auto-open, the button still works.
    return false;
  }
}

/**
 * Step-by-step "How to play" walk-through for the harder games (issue #4).
 * Opens by itself on a patient's first visit on this device, and any time
 * from the "How to play" button. Each step is one picture and one short
 * sentence, read aloud, so it works for patients who struggle to read.
 */
export default function GameTutorial({ gameId, steps }: GameTutorialProps) {
  const { t, language } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Deferred one microtask per this codebase's effect-derived state convention.
    queueMicrotask(() => {
      if (isFirstVisit(gameId)) setOpen(true);
    });
  }, [gameId]);

  const current = steps[step];

  useEffect(() => {
    if (!open || !current) return;
    void narrate(t(current.textKey), language, isOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const close = () => {
    stopAllAudio();
    setOpen(false);
    setStep(0);
  };

  const isLast = step >= steps.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        className="min-h-12 rounded-tile border-2 border-line200 bg-surface-card px-5 py-2 text-patient-body font-semibold text-ink hover:border-primary/40 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
        data-testid="how-to-play"
      >
        ❓ {t('game.tutorial.howToPlay')}
      </button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('game.tutorial.title')}</DialogTitle>
            <p className="text-patient-sm text-ink-muted">
              {t('game.tutorial.stepOf', { n: step + 1, total: steps.length })}
            </p>
          </DialogHeader>

          {current ? (
            <div className="flex flex-col items-center gap-4 text-center" data-testid="tutorial-step">
              <div className="flex min-h-28 items-center justify-center rounded-card bg-surface-muted px-6 py-4 text-6xl leading-none" aria-hidden="true">
                {current.visual}
              </div>
              <p className="text-patient-body text-ink">{t(current.textKey)}</p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <BigButton
              label={isLast ? t('game.tutorial.gotIt') : t('game.tutorial.next')}
              variant="primary"
              onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            />
            {step > 0 ? (
              <BigButton label={t('game.tutorial.back')} variant="secondary" onClick={() => setStep((s) => s - 1)} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const TUTORIALS: Record<'quick_tap' | 'path_match' | 'counting_boxes', TutorialStep[]> = {
  quick_tap: [
    { visual: '🍎', textKey: 'game.tutorial.quickTap.step1' },
    { visual: '🍌 🍎 🥕', textKey: 'game.tutorial.quickTap.step2' },
    { visual: '🍎 👆', textKey: 'game.tutorial.quickTap.step3' },
    { visual: '🥕 ✋', textKey: 'game.tutorial.quickTap.step4' },
  ],
  path_match: [
    { visual: '① ② ③', textKey: 'game.tutorial.pathMatch.step1' },
    { visual: '①→②', textKey: 'game.tutorial.pathMatch.step2' },
    { visual: '①→②→③', textKey: 'game.tutorial.pathMatch.step3' },
    { visual: '⏱️', textKey: 'game.tutorial.pathMatch.step4' },
  ],
  counting_boxes: [
    { visual: '🟦🟦🟦', textKey: 'game.tutorial.countingBoxes.step1' },
    { visual: '👀', textKey: 'game.tutorial.countingBoxes.step2' },
    { visual: '🔢', textKey: 'game.tutorial.countingBoxes.step3' },
  ],
};
