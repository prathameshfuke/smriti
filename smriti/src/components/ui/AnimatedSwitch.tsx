'use client';

import { motion, useReducedMotion } from 'framer-motion';

export interface AnimatedSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

/**
 * Caregiver-facing on/off control — a spring-driven thumb slide, not a
 * relabeled checkbox. `touch-min` (48px, DESIGN.md) sizes the tappable
 * wrapper even though the visible track is smaller, same pattern as
 * `LanguagePicker`'s `minHeight` override on a narrower visual element.
 * `useReducedMotion` swaps the spring for an instant flip, matching the
 * `motion-reduce:` treatment used on every other interactive element here.
 */
export default function AnimatedSwitch({ checked, onChange, label, disabled = false }: AnimatedSwitchProps) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        'flex min-h-touch-min min-w-touch-min items-center justify-center rounded-control ' +
        'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 ' +
        'focus-visible:outline-primary-dark disabled:opacity-50'
      }
    >
      <span
        aria-hidden="true"
        className={
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-150 ' +
          (checked ? 'border-primary bg-primary' : 'border-ink-muted bg-surface-card')
        }
      >
        <motion.span
          className={`h-4 w-4 rounded-full ${checked ? 'bg-white' : 'bg-ink-muted'}`}
          animate={{ x: checked ? 23 : 3 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 32 }}
        />
      </span>
    </button>
  );
}
