'use client';

import { Delete } from 'lucide-react';
import { TOUCH_TARGET_MIN_PX } from './touchTarget';

export interface PinPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

/**
 * Numeric keypad for PIN entry. Shared by the home-screen "My Progress" gate
 * and onboarding's PIN-creation step so the two never drift into slightly
 * different touch targets or key layouts.
 */
export default function PinPad({ onDigit, onBackspace, disabled = false }: PinPadProps) {
  return (
    <div role="group" aria-label="PIN keypad" className="grid grid-cols-3 gap-3">
      {KEYS.map((key, i) => {
        if (key === '') return <span key={`blank-${i}`} aria-hidden="true" />;

        const isBackspace = key === 'back';
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={isBackspace ? 'Backspace' : key}
            onClick={() => (isBackspace ? onBackspace() : onDigit(key))}
            style={{ minHeight: TOUCH_TARGET_MIN_PX, minWidth: TOUCH_TARGET_MIN_PX }}
            className={
              'flex items-center justify-center rounded-tile border border-black/5 bg-surface-card ' +
              'text-patient-heading shadow-sm font-semibold text-ink transition-all duration-100 ' +
              'active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-surface-muted hover:shadow-md ' +
              'disabled:opacity-40 disabled:pointer-events-none focus-visible:outline focus-visible:outline-4 ' +
              'focus-visible:outline-offset-2 focus-visible:outline-primary-dark'
            }
          >
            {isBackspace ? <Delete size={28} aria-hidden="true" /> : key}
          </button>
        );
      })}
    </div>
  );
}
