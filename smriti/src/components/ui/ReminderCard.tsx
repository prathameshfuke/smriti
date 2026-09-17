'use client';

import { useEffect, useRef } from 'react';
import BigButton from './BigButton';
import { narrate } from '@/lib/audio/narrate';
import { hasTranslation, useTranslation, type UILanguage } from '@/lib/i18n/provider';
import { textFitsLanguage } from '@/lib/i18n/script';
import { buildAppointmentPrompt, type AppointmentOccurrence } from '@/lib/engine/appointments';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import type { LocalReminderSchedule } from '@/lib/db/schema';
import type { ReminderType } from '@/lib/supabase/types';

export interface ReminderCardProps {
  reminder: LocalReminderSchedule;
  onAcknowledge: () => void;
  onSnooze: () => void;
  /** On a shared phone: who the reminder is for, shown above it. */
  forName?: string;
  /** For a dated appointment: which of its two prompts this is. */
  occurrence?: AppointmentOccurrence;
}

/** Used inside the Routine Recall game's own picture cards. The reminder overlay itself shows only the translated words, no emoji. */
export const REMINDER_ICON: Record<ReminderType, { src: string; bg: string }> = {
  medication: { src: '/images/reminders/medication.png', bg: 'bg-primary/15' },
  hydration: { src: '/images/reminders/hydration.png', bg: 'bg-primary/15' },
  activity: { src: '/images/reminders/activity.png', bg: 'bg-primary/15' },
  appointment: { src: '/images/reminders/appointment.png', bg: 'bg-primary/15' },
};

function displayLabel(label: string, reminderType: ReminderType, language: UILanguage, t: (key: string) => string): string {
  return textFitsLanguage(label, language) ? label : t(`reminder.${reminderType}`);
}

/**
 * Full-screen overlay for a due reminder. Snooze only dismisses the card:
 * the reminder stays unacknowledged, so `useReminders`' next 60s poll picks
 * it back up as still-due — that stands in for an internal re-trigger timer,
 * which can't outlive a card that unmounts on dismiss.
 */
export default function ReminderCard({ reminder, onAcknowledge, onSnooze, forName, occurrence }: ReminderCardProps) {
  const { language, t } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const cardRef = useRef<HTMLDivElement>(null);
  const doneLabel = `${t('reminder.done')} ✓`;
  const appointment = occurrence
    ? buildAppointmentPrompt(reminder, occurrence, language, t, (key) => hasTranslation(language, key))
    : null;
  const label = appointment?.display ?? displayLabel(reminder.label, reminder.reminderType, language, t);
  // Where to go and what to bring are read on screen, not aloud: long, and
  // often in English whatever the patient's language.
  const details = appointment
    ? [
        { heading: t('reminder.whereToGo'), text: reminder.locationNotes },
        { heading: t('reminder.whatToBring'), text: reminder.bringNotes },
      ].filter((d): d is { heading: string; text: string } => Boolean(d.text))
    : [];

  useEffect(() => {
    void narrate(appointment?.speech ?? label, language, isOnline);
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
        {appointment ? null : <p className="text-caregiver-body font-bold text-ink-muted">{t('reminder.timeFor')}</p>}
        <p
          id="reminder-card-label"
          className="mt-3 break-words font-serif-display text-patient-heading font-medium text-ink"
        >
          {label}
        </p>
        {details.length > 0 ? (
          <dl className="mt-5 flex flex-col gap-3">
            {details.map((d) => (
              <div key={d.heading}>
                <dt className="text-caregiver-body font-bold text-ink-muted">{d.heading}</dt>
                <dd className="whitespace-pre-line break-words text-patient-body text-ink">{d.text}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-8 flex flex-col gap-touch-gap">
          <BigButton label={doneLabel} variant="success" onClick={onAcknowledge} />
          <BigButton label={t('reminder.remindLater')} variant="secondary" onClick={onSnooze} />
        </div>
      </div>
    </div>
  );
}
