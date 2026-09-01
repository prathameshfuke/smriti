'use client';

import { useEffect } from 'react';
import BigButton from '@/components/ui/BigButton';
import { speak } from '@/lib/audio/speech';
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
const ENCOURAGEMENT: Record<number, string> = {
  5: 'Perfect! Wonderful work today!',
  4: 'Excellent! You are doing great!',
  3: 'Great job today! Keep it up!',
  2: 'Good effort! Every session helps.',
  1: 'Well done for trying! Each day gets better.',
};

export default function SessionComplete({
  stars,
  correctCount,
  totalCount,
  onGoHome,
}: SessionCompleteProps) {
  const safeStars = Math.max(1, Math.min(5, Math.round(stars)));
  const message = ENCOURAGEMENT[safeStars];

  useEffect(() => {
    speak(message);
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
      <BigButton label="Back to Home" variant="success" onClick={onGoHome} />
    </div>
  );
}
