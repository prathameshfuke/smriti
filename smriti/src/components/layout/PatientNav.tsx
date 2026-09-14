'use client';

import { useTranslation } from '@/lib/i18n/provider';
import { ChevronLeft } from 'lucide-react';
import Icon from '@/components/Icon';
import { NAV_BAR_PX, TOUCH_TARGET_MIN_PX } from '@/components/ui/touchTarget';

export interface PatientNavProps {
  title: string;
  /** Omitted on the home screen — there is nowhere to go back to. */
  onBack?: () => void;
}

/**
 * Fixed 64px top bar: title, and one way back. No hamburger, no swipe, no
 * nested menus — a patient who gets lost needs exactly one visible escape,
 * always in the same place. The escape says "Back" in words next to the
 * arrow: an arrow alone asks the patient to remember what it means.
 */
export default function PatientNav({ title, onBack }: PatientNavProps) {
  const { t } = useTranslation();
  return (
    <header
      style={{ height: NAV_BAR_PX }}
      className="sticky top-0 z-40 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-1 items-center border-b border-line200 bg-surface px-2"
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.goBack')}
          style={{ minHeight: TOUCH_TARGET_MIN_PX }}
          className={
            'flex items-center gap-1 justify-self-start rounded-control pl-1 pr-3 text-patient-body font-bold text-ink ' +
            'transition-[transform,background-color] duration-150 hover:bg-surface-muted active:scale-[0.97] ' +
            'motion-reduce:active:scale-100 focus-visible:outline ' +
            'focus-visible:outline-4 focus-visible:outline-offset-[-4px] ' +
            'focus-visible:outline-primary-dark'
          }
        >
          <Icon icon={ChevronLeft} size={28} />
          <span>{t('common.back')}</span>
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
      <h1 className="max-w-[60vw] truncate text-center text-patient-body font-bold text-ink">{title}</h1>
      <span aria-hidden="true" />
    </header>
  );
}
