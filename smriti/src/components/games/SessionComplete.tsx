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
    <div className="flex min-h-dvh flex-col justify-center bg-surface px-6 py-10">
      <div className="mx-auto flex w-full max-w-patient flex-col gap-6">
        <div role="img" aria-label={`${safeStars} of 5 stars`} className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} filled={i < safeStars} />
          ))}
        </div>
        <div>
          <p className="font-serif-display text-patient-heading font-medium text-ink">
            {correctCount} out of {totalCount} correct
          </p>
          <p className="mt-3 text-patient-body text-ink-muted">{message}</p>
        </div>
        <BigButton label="Back to home" variant="primary" onClick={onGoHome} />
      </div>
    </div>
  );
}

/** Five-point star, muga gold. The gold outline on empty stars keeps the
 * count of five visible, so one star reads as "one of five", not "one". */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.8l2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 17.13 6.38 20.1l1.07-6.27L2.9 9.4l6.3-.9L12 2.8z"
        fill={filled ? '#C9A227' : 'none'}
        stroke={filled ? '#8B6914' : '#C9A227'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
