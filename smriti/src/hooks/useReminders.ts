'use client';

import { useEffect, useRef, useState } from 'react';
import { getRemindersDueNow } from '@/lib/engine/reminders';
import { usePatientStore } from '@/stores/patientStore';
import { getDevicePatients } from '@/lib/auth/localSession';
import type { LocalReminderSchedule } from '@/lib/db/schema';

const POLL_INTERVAL_MS = 60_000;

/**
 * Polls for due reminders and surfaces the first one as an in-app card.
 * Checks every patient on this phone, not only whoever is selected: on a
 * shared phone, Hari's medicine reminder must still appear while Maya is
 * playing. The card names the person it is for.
 */
export function useReminders(): {
  pendingReminder: LocalReminderSchedule | null;
  clearPendingReminder: () => void;
} {
  const [pendingReminder, setPendingReminder] = useState<LocalReminderSchedule | null>(null);
  const pendingRef = useRef<LocalReminderSchedule | null>(null);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    const tick = async () => {
      const currentPatient = usePatientStore.getState().currentPatient;
      const devicePatients = await getDevicePatients().catch(() => []);
      const ids = devicePatients.length > 0 ? devicePatients.map((p) => p.id) : currentPatient ? [currentPatient.id] : [];
      if (ids.length === 0) return;

      // Whoever is playing first, so their own reminder wins a tie.
      const ordered = currentPatient ? [currentPatient.id, ...ids.filter((id) => id !== currentPatient.id)] : ids;
      let next: LocalReminderSchedule | undefined;
      for (const id of ordered) {
        next = (await getRemindersDueNow(id))[0];
        if (next) break;
      }
      if (!next || pendingRef.current) return;

      pendingRef.current = next;
      setPendingReminder(next);

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('SMRITI', { body: next.label, icon: '/icons/icon-192.png' });
      }
    };

    void tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const clearPendingReminder = () => {
    pendingRef.current = null;
    setPendingReminder(null);
  };

  return { pendingReminder, clearPendingReminder };
}
