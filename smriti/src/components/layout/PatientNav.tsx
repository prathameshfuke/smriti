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
 * 64px-minimum top bar: title, and one way back. No hamburger, no swipe, no
 * nested menus — a patient who gets lost needs exactly one visible escape,
 * always in the same place. The escape says "Back" in words next to the
 * arrow: an arrow alone asks the patient to remember what it means.
 *
 * Flex, not a 1fr/auto/1fr grid: the grid gave the title priority, so at
 * Large text and icon size the Back label ran underneath it. Here both side
 * slots grow equally from zero (the title stays centred whenever there is
 * room), the Back slot never shrinks below its own content, and the title is
 * the one that gives way — wrapping to a second line and growing the bar
 * rather than overlapping.
 */
export default function PatientNav({ title, onBack }: PatientNavProps) {
  const { t } = useTranslation();
  return (
    <header
      style={{ minHeight: NAV_BAR_PX }}
      className="sticky top-0 z-40 flex w-full items-center gap-1 border-b border-line200 bg-surface px-2"
    >
      <div className="flex flex-1 basis-0 justify-start">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('common.goBack')}
            style={{ minHeight: TOUCH_TARGET_MIN_PX }}
            className={
              'flex min-w-0 items-center gap-1 rounded-control pl-1 pr-3 text-patient-body font-bold text-ink ' +
              'transition-[transform,background-color] duration-150 hover:bg-surface-muted active:scale-[0.97] ' +
              'motion-reduce:active:scale-100 focus-visible:outline ' +
              'focus-visible:outline-4 focus-visible:outline-offset-[-4px] ' +
              'focus-visible:outline-primary-dark'
            }
          >
            <Icon icon={ChevronLeft} size={28} className="shrink-0" />
            {/* May wrap: Assamese "উভতি যাওক" is two words, and kept on one line
                it pushed a 320px screen sideways at Large text. */}
            <span className="min-w-0 text-left leading-tight">{t('common.back')}</span>
          </button>
        ) : null}
      </div>
      <h1 className="line-clamp-2 min-w-0 shrink break-words text-center text-patient-body font-bold leading-tight text-ink">
        {title}
      </h1>
      <span aria-hidden="true" className="flex-1 basis-0" />
    </header>
  );
}
