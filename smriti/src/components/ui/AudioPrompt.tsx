'use client';

import { Volume2 } from 'lucide-react';
import { TOUCH_TARGET_MIN_PX } from './touchTarget';

export interface AudioPromptProps {
  /** Text shown on screen and used as the accessible name. */
  text: string;
  /** Pre-cached audio asset, e.g. /audio/as/home-greeting.mp3 */
  src?: string;
  onPlay?: () => void;
}

/**
 * Replays the spoken instruction. Every instruction is audio-first: patients
 * with low literacy rely on it, and repeating it must always be one tap away.
 */
export default function AudioPrompt({ text, src, onPlay }: AudioPromptProps) {
  const play = () => {
    onPlay?.();
    if (!src) return;
    // Playback can reject (no user gesture, missing asset). The prompt is
    // still on screen, so a failure must not break the game.
    void new Audio(src).play().catch(() => undefined);
  };

  return (
    <div className="flex items-center gap-touch-gap">
      <button
        type="button"
        onClick={play}
        aria-label={`Play instruction: ${text}`}
        style={{ minHeight: TOUCH_TARGET_MIN_PX, minWidth: TOUCH_TARGET_MIN_PX }}
        className={
          'flex items-center justify-center rounded-full bg-primary text-ink-inverse ' +
          'transition-colors hover:bg-primary-dark focus-visible:outline ' +
          'focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark'
        }
      >
        <Volume2 size={28} aria-hidden="true" />
      </button>
      <p className="text-patient-body text-ink">{text}</p>
    </div>
  );
}
