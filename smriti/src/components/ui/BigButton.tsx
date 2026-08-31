'use client';

import type { ReactNode } from 'react';
import { TOUCH_TARGET_MIN_PX } from './touchTarget';

export interface BigButtonProps {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

/**
 * The primary patient-facing control. Large, high-contrast, and always
 * labelled: the same string feeds the accessible name and the audio prompt,
 * so a patient who cannot read still gets the identical instruction.
 */
export default function BigButton({
  label,
  icon,
  onClick,
  variant = 'primary',
  disabled = false,
}: BigButtonProps) {
  const base =
    'flex w-full items-center justify-center gap-touch-gap rounded-tile px-6 py-4 ' +
    'text-patient-body font-semibold transition-colors ' +
    'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-primary-dark active:translate-y-px ' +
    'disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    primary: 'bg-primary text-ink-inverse hover:bg-primary-dark',
    secondary: 'bg-surface-card text-ink border-2 border-primary hover:bg-surface-muted',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{ minHeight: TOUCH_TARGET_MIN_PX }}
      className={`${base} ${variants[variant]}`}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}
