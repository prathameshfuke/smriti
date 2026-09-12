'use client';

import { useEffect } from 'react';
import BigButton from '@/components/ui/BigButton';
import { narrate } from '@/lib/audio/narrate';
import { useTranslation } from '@/lib/i18n/provider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import type { GameType } from '@/lib/supabase/types';

export interface SessionCompleteProps {
  gameType: GameType;
  stars: number;
  correctCount: number;
  totalCount: number;
  onGoHome: () => void;
}

/**
 * Messages never use a fail/error vocabulary — a low-star session is still
 * framed as progress, never as a mistake the patient made.
 */
const ENCOURAGEMENT_KEY: Record<number, string> = {
  5: 'game.sessionEnd.star5',
  4: 'game.sessionEnd.star4',
  3: 'game.sessionEnd.star3',
  2: 'game.sessionEnd.star2',
  1: 'game.sessionEnd.star1',
};

export default function SessionComplete({
  stars,
  correctCount,
  totalCount,
  onGoHome,
}: SessionCompleteProps) {
  const { t, language } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const safeStars = Math.max(1, Math.min(5, Math.round(stars)));
  const message = t(ENCOURAGEMENT_KEY[safeStars]);

  useEffect(() => {
    void narrate(message, language, isOnline);
    // Speak once, when this screen appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-game-bg px-4 text-center">
      <p className="text-4xl" aria-hidden="true">
        {'⭐'.repeat(safeStars)}
        {'☆'.repeat(5 - safeStars)}
      </p>
      <p className="text-patient-heading text-ink">
        {correctCount} out of {totalCount} correct!
      </p>
      <p className="text-patient-body text-ink-muted">{message}</p>
      <BigButton label="Back to home" variant="success" onClick={onGoHome} />
    </div>
  );
}
