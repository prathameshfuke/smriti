'use client';

import { useEffect, useRef, useState } from 'react';
import { getRemindersDueNow } from '@/lib/engine/reminders';
import { usePatientStore } from '@/stores/patientStore';
import type { LocalReminderSchedule } from '@/lib/db/schema';

const POLL_INTERVAL_MS = 60_000;

/** Polls for due reminders and surfaces the first one as an in-app card. */
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
      if (!currentPatient) return;

      const due = await getRemindersDueNow(currentPatient.id);
      const next = due[0];
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
