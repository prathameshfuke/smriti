'use client';

import { useEffect, useRef } from 'react';
import BigButton from './BigButton';
import { narrate } from '@/lib/audio/narrate';
import { useTranslation, type UILanguage } from '@/lib/i18n/provider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import type { LocalReminderSchedule } from '@/lib/db/schema';
import type { ReminderType } from '@/lib/supabase/types';

export interface ReminderCardProps {
  reminder: LocalReminderSchedule;
  onAcknowledge: () => void;
  onSnooze: () => void;
  /** On a shared phone: who the reminder is for, shown above it. */
  forName?: string;
}

/** Used inside the Routine Recall game's own picture cards. The reminder overlay itself shows only the translated words, no emoji. */
export const REMINDER_ICON: Record<ReminderType, { src: string; bg: string }> = {
  medication: { src: '/images/reminders/medication.png', bg: 'bg-primary/15' },
  hydration: { src: '/images/reminders/hydration.png', bg: 'bg-primary/15' },
  activity: { src: '/images/reminders/activity.png', bg: 'bg-primary/15' },
  appointment: { src: '/images/reminders/appointment.png', bg: 'bg-primary/15' },
};

/** Script ranges for the two non-Latin UI languages. Used to detect a
 * reminder's caregiver-typed `label` that's plainly in English (no matching
 * script present) so it can fall back to the translated per-type phrase
 * instead of reading/showing English text to a Hindi/Assamese-only patient.
 * `label` is freeform caregiver text (see reminders/page.tsx), never one of
 * the catalog's own English defaults verbatim, so an exact-string match
 * against the catalog would essentially never fire — script detection is
 * the only heuristic that actually catches the common case. */
const SCRIPT_RANGE: Partial<Record<UILanguage, RegExp>> = {
  hi: /[ऀ-ॿ]/,
  as: /[ঀ-৿]/,
  // Bodo and Nepali both use Devanagari here, same range as Hindi.
  brx: /[ऀ-ॿ]/,
  ne: /[ऀ-ॿ]/,
  // Bengali, and Manipuri (written in Bengali script in this app — see
  // languages.ts), share the same Unicode block as Assamese.
  bn: /[ঀ-৿]/,
  mni: /[ঀ-৿]/,
};

function displayLabel(label: string, reminderType: ReminderType, language: UILanguage, t: (key: string) => string): string {
  const script = SCRIPT_RANGE[language];
  if (!script || script.test(label)) return label;
  return t(`reminder.${reminderType}`);
}

/**
 * Full-screen overlay for a due reminder. Snooze only dismisses the card:
 * the reminder stays unacknowledged, so `useReminders`' next 60s poll picks
 * it back up as still-due — that stands in for an internal re-trigger timer,
 * which can't outlive a card that unmounts on dismiss.
 */
export default function ReminderCard({ reminder, onAcknowledge, onSnooze, forName }: ReminderCardProps) {
  const { language, t } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const cardRef = useRef<HTMLDivElement>(null);
  const doneLabel = `${t('reminder.done')} ✓`;
  const label = displayLabel(reminder.label, reminder.reminderType, language, t);

  useEffect(() => {
    void narrate(label, language, isOnline);
    cardRef.current
      ?.querySelector<HTMLButtonElement>(`[aria-label="${doneLabel}"]`)
      ?.focus();
    // Fire once, when this reminder appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center">
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reminder-card-label"
        className="max-h-full w-full max-w-patient overflow-y-auto overscroll-contain rounded-card bg-surface-card p-6 shadow-2xl sm:p-8"
      >
        {forName ? (
          <p className="mb-2 font-serif-display text-[1.75rem] font-medium leading-tight text-primary-dark">{forName}</p>
        ) : null}
        <p className="text-caregiver-body font-bold text-ink-muted">{t('reminder.timeFor')}</p>
        <p
          id="reminder-card-label"
          className="mt-3 font-serif-display text-patient-heading font-medium text-ink"
        >
          {label}
        </p>

        <div className="mt-8 flex flex-col gap-touch-gap">
          <BigButton label={doneLabel} variant="success" onClick={onAcknowledge} />
          <BigButton label={t('reminder.remindLater')} variant="secondary" onClick={onSnooze} />
        </div>
      </div>
    </div>
  );
}
