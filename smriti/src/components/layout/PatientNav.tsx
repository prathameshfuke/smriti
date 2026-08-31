'use client';

import { ChevronLeft } from 'lucide-react';
import { NAV_BAR_PX, TOUCH_TARGET_MIN_PX } from '@/components/ui/touchTarget';

export interface PatientNavProps {
  title: string;
  /** Omitted on the home screen — there is nowhere to go back to. */
  onBack?: () => void;
}

/**
 * Fixed 64px top bar: title, and one way back. No hamburger, no swipe, no
 * nested menus — a patient who gets lost needs exactly one visible escape,
 * always in the same place.
 */
export default function PatientNav({ title, onBack }: PatientNavProps) {
  return (
    <header
      style={{ height: NAV_BAR_PX }}
      className="sticky top-0 z-40 flex w-full items-center gap-2 border-b border-surface-muted bg-surface-card px-2"
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          style={{ minHeight: TOUCH_TARGET_MIN_PX, minWidth: TOUCH_TARGET_MIN_PX }}
          className={
            'flex items-center justify-center rounded-tile text-ink ' +
            'transition-transform duration-100 active:scale-[0.97] ' +
            'motion-reduce:active:scale-100 focus-visible:outline ' +
            'focus-visible:outline-4 focus-visible:outline-offset-[-4px] ' +
            'focus-visible:outline-primary'
          }
        >
          <ChevronLeft size={36} aria-hidden="true" />
        </button>
      ) : (
        <span style={{ width: TOUCH_TARGET_MIN_PX }} aria-hidden="true" />
      )}
      <h1 className="flex-1 truncate text-center text-patient-body font-semibold text-ink">
        {title}
      </h1>
      <span style={{ width: TOUCH_TARGET_MIN_PX }} aria-hidden="true" />
    </header>
  );
}
