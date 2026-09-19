'use client';

import { useEffect, useRef, useState } from 'react';
import { getDueReminders, type DueReminder } from '@/lib/engine/reminders';
import { occurrenceKey as notifyKey } from '@/lib/engine/dueCore';
import { refreshNotifyPrefs, showReminderNotification } from '@/lib/push/client';
import { NOTIFICATION_STRING_KEYS } from '@/lib/push/reminderText';
import { useTranslation } from '@/lib/i18n/provider';
import type { AppointmentOccurrence } from '@/lib/engine/appointments';
import { usePatientStore } from '@/stores/patientStore';
import { getDevicePatients } from '@/lib/auth/localSession';
import type { LocalReminderSchedule } from '@/lib/db/schema';

const POLL_INTERVAL_MS = 60_000;
/** Matches the card's "Remind me in 15 minutes". */
const APPOINTMENT_SNOOZE_MS = 15 * 60_000;

const occurrenceKey = (d: DueReminder) => `${d.schedule.id}:${d.occurrence?.date}`;

/**
 * Polls for due reminders and surfaces the first one as an in-app card.
 * Checks every patient on this phone, not only whoever is selected: on a
 * shared phone, Hari's medicine reminder must still appear while Maya is
 * playing. The card names the person it is for.
 */
export function useReminders(): {
  pendingReminder: LocalReminderSchedule | null;
  /** Set when the pending reminder is one of a dated appointment's prompts. */
  pendingOccurrence: AppointmentOccurrence | null;
  clearPendingReminder: () => void;
  snoozePendingReminder: () => void;
} {
  const { t, language } = useTranslation();
  const [pending, setPending] = useState<DueReminder | null>(null);
  const pendingRef = useRef<DueReminder | null>(null);
  // An appointment prompt stays due for hours (see lib/engine/appointments.ts),
  // so without this "later" would bring it back on the very next poll.
  // Weekday reminders keep their old behaviour: their ±2 minute window closes
  // on its own.
  const snoozedUntil = useRef(new Map<string, number>());

  // The service worker has no i18n of its own: keep the generic wording it
  // shows for a reminder in step with the chosen language. The permission
  // itself is asked for by the opt-in card (NotificationOptIn), on a tap.
  useEffect(() => {
    const strings = Object.fromEntries(NOTIFICATION_STRING_KEYS.map((k) => [k, t(`reminder.${k}`)]));
    void refreshNotifyPrefs({ language, title: 'SMRITI', strings });
  }, [language, t]);

  useEffect(() => {
    const tick = async () => {
      const currentPatient = usePatientStore.getState().currentPatient;
      const devicePatients = await getDevicePatients().catch(() => []);
      const ids = devicePatients.length > 0 ? devicePatients.map((p) => p.id) : currentPatient ? [currentPatient.id] : [];
      if (ids.length === 0) return;

      // Whoever is playing first, so their own reminder wins a tie.
      const ordered = currentPatient ? [currentPatient.id, ...ids.filter((id) => id !== currentPatient.id)] : ids;
      const now = Date.now();
      let next: DueReminder | undefined;
      for (const id of ordered) {
        next = (await getDueReminders(id)).find(
          (d) => !d.occurrence || (snoozedUntil.current.get(occurrenceKey(d)) ?? 0) <= now,
        );
        if (next) break;
      }
      if (!next || pendingRef.current) return;

      pendingRef.current = next;
      setPending(next);

      // Once per occurrence across the page, the service worker and Web Push
      // (see lib/push/notifyStore.ts). The in-app card above shows regardless.
      void showReminderNotification(
        notifyKey(next, new Date()),
        'SMRITI',
        next.schedule.facilityName ?? next.schedule.label,
      );
    };

    void tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const clearPendingReminder = () => {
    pendingRef.current = null;
    setPending(null);
  };

  const snoozePendingReminder = () => {
    const current = pendingRef.current;
    if (current?.occurrence) snoozedUntil.current.set(occurrenceKey(current), Date.now() + APPOINTMENT_SNOOZE_MS);
    clearPendingReminder();
  };

  return {
    pendingReminder: pending?.schedule ?? null,
    pendingOccurrence: pending?.occurrence ?? null,
    clearPendingReminder,
    snoozePendingReminder,
  };
}
