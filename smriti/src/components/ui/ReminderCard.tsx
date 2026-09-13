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
}

/** Exported so other reminder-driven surfaces (e.g. Routine Recall) reuse the same icons rather than inventing new ones. */
export const REMINDER_ICON: Record<ReminderType, { emoji: string; bg: string }> = {
  medication: { emoji: '💊', bg: 'bg-primary/20' },
  hydration: { emoji: '💧', bg: 'bg-blue-100' },
  activity: { emoji: '🚶', bg: 'bg-green-100' },
  appointment: { emoji: '📅', bg: 'bg-orange-100' },
};
const ICON = REMINDER_ICON;

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
export default function ReminderCard({ reminder, onAcknowledge, onSnooze }: ReminderCardProps) {
  const { language, t } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const cardRef = useRef<HTMLDivElement>(null);
  const icon = ICON[reminder.reminderType];
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div ref={cardRef} className="mx-4 max-w-patient rounded-tile bg-surface-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full ${icon.bg}`}
            aria-hidden="true"
          >
            <span className="text-5xl">{icon.emoji}</span>
          </div>
          <p className="text-caregiver-body text-ink-muted">{t('reminder.timeFor')}</p>
          <p className="font-serif-display text-patient-heading font-bold text-ink">{label}</p>

          <BigButton label={doneLabel} variant="success" onClick={onAcknowledge} />

          <button type="button" onClick={onSnooze} className="text-ink-muted underline">
            {t('reminder.remindLater')}
          </button>
        </div>
      </div>
    </div>
  );
}
