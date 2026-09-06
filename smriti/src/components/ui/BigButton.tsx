'use client';

import type { ReactNode } from 'react';
import { BIG_TARGET_MIN_PX } from './touchTarget';

export interface BigButtonProps {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success';
  /** Spoken version of the label, replayed on every press. */
  audioSrc?: string;
  disabled?: boolean;
}

const VARIANTS = {
  primary: 'bg-primary text-ink-inverse shadow-sm hover:bg-primary-dark hover:shadow-md',
  secondary: 'bg-surface-card text-ink border-2 border-primary shadow-sm hover:bg-surface-muted',
  success: 'bg-success text-ink-inverse shadow-sm hover:brightness-95 hover:shadow-md',
} as const;

/**
 * The primary patient-facing control. Large, high-contrast, and always
 * labelled: the same string feeds the accessible name and the audio prompt,
 * so a patient who cannot read still gets the identical instruction.
 *
 * Pressing scales the button down — the feedback a patient watching their own
 * thumb can see. The focus ring is kept alongside it because the two serve
 * different users: `:active` fires on pointer-down, `:focus-visible` fires on
 * keyboard and switch navigation, which WCAG 2.4.7 (PRD s6, AA) requires.
 */
export default function BigButton({
  label,
  icon,
  onClick,
  variant = 'primary',
  audioSrc,
  disabled = false,
}: BigButtonProps) {
  const press = () => {
    if (audioSrc) {
      // Playback can reject (no gesture yet, asset missing). The button must
      // still work; audio is reinforcement, never the only channel.
      void new Audio(audioSrc).play().catch(() => undefined);
    }
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={press}
      disabled={disabled}
      aria-label={label}
      style={{ minHeight: BIG_TARGET_MIN_PX }}
      className={
        'flex w-full items-center justify-center gap-touch-gap rounded-tile px-6 py-4 ' +
        'text-patient-body font-semibold transition-transform duration-100 ' +
        'active:scale-[0.97] motion-reduce:active:scale-100 ' +
        'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 ' +
        'focus-visible:outline-primary-dark ' +
        'disabled:opacity-50 disabled:pointer-events-none ' +
        VARIANTS[variant]
      }
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}
