'use client';

import type { ReactNode } from 'react';

export interface AudioPromptProps {
  /** Pre-cached audio asset, e.g. /audio/as/home-greeting.mp3 */
  src: string;
  children: ReactNode;
  /** Fires when the clip finishes — used to unlock the next game step. */
  onComplete?: () => void;
  autoPlay?: boolean;
}

/**
 * Invisible wrapper that speaks an instruction over whatever it wraps.
 *
 * It adds no chrome: the instruction on screen is the visible half, and the
 * audio is the half a patient who cannot read relies on. Autoplay may be
 * refused before the first gesture, so the visible content always stands
 * alone.
 */
export default function AudioPrompt({
  src,
  children,
  onComplete,
  autoPlay = true,
}: AudioPromptProps) {
  return (
    <>
      {children}
      <audio
        src={src}
        autoPlay={autoPlay}
        preload="auto"
        onEnded={onComplete}
        aria-hidden="true"
      />
    </>
  );
}
