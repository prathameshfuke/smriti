import { v4 as uuid } from 'uuid';
import { db, type LocalReminderAck, type LocalReminderSchedule } from '@/lib/db/schema';
import { buildQueueItem } from '@/lib/db/syncQueue';
import { toHHMM, type AckMethod } from '@/lib/supabase/types';
import { localDateString } from './adherence';
import { appointmentDueNow, isDatedAppointment, type AppointmentOccurrence } from './appointments';

const HYDRATION_TIMES = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
const DUE_WINDOW_MINUTES = 2;

/** 8 evenly-spaced daily hydration prompts, every day. */
export function generateDefaultHydrationSchedule(patientId: string): LocalReminderSchedule[] {
  const updatedAt = new Date().toISOString();
  return HYDRATION_TIMES.map((timeOfDay) => ({
    id: uuid(),
    patientId,
    reminderType: 'hydration',
    label: 'Drink water',
    timeOfDay,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isActive: true,
    updatedAt,
    createdAt: updatedAt,
  }));
}

/** Writes schedules alongside their sync-queue entries, same transaction. */
export async function saveReminderSchedules(schedules: LocalReminderSchedule[]): Promise<void> {
  await db.transaction('rw', db.reminderSchedules, db.syncQueue, async () => {
    await db.reminderSchedules.bulkPut(schedules);
    await db.syncQueue.bulkPut(
      schedules.map((s) => buildQueueItem('reminder_schedules', s.id, 'insert', { ...s })),
    );
  });
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}


export interface DueReminder {
  schedule: LocalReminderSchedule;
  /** Set for a dated appointment: which of its two prompts is due. */
  occurrence?: AppointmentOccurrence;
}

/**
 * Reminders for `patientId` due at `now` and not yet acknowledged.
 *
 * Weekday reminders are due within ±2 minutes of their time. A dated
 * appointment follows its own day-before/day-of windows instead
 * (lib/engine/appointments.ts), keyed by the occurrence date.
 */
export async function getDueReminders(patientId: string, now: Date = new Date()): Promise<DueReminder[]> {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  const todayStr = localDateString(now);

  const schedules = await db.reminderSchedules.where('patientId').equals(patientId).toArray();
  const acks = (await db.reminderAcks.where('patientId').equals(patientId).toArray()).filter((a) => a.acknowledgedAt);
  const ackedTodayIds = new Set(
    acks.filter((a) => localDateString(new Date(a.acknowledgedAt as string)) === todayStr).map((a) => a.reminderId),
  );
  const ackedOccurrenceKeys = new Set(acks.map((a) => `${a.reminderId}:${a.scheduledAt.slice(0, 10)}`));

  const due: DueReminder[] = [];
  for (const s of schedules) {
    if (isDatedAppointment(s)) {
      const occurrence = appointmentDueNow(s, now, ackedOccurrenceKeys);
      if (occurrence) due.push({ schedule: s, occurrence });
      continue;
    }
    if (!s.isActive) continue;
    if (!s.daysOfWeek.includes(today)) continue;
    if (ackedTodayIds.has(s.id)) continue;
    if (Math.abs(toMinutes(s.timeOfDay) - nowMinutes) <= DUE_WINDOW_MINUTES) due.push({ schedule: s });
  }
  return due;
}

/** Reminders for `patientId` that are due right now and not yet acknowledged today. */
export async function getRemindersDueNow(patientId: string, now: Date = new Date()): Promise<LocalReminderSchedule[]> {
  return (await getDueReminders(patientId, now)).map((d) => d.schedule);
}

/** Records that a reminder was handled, with the sync-queue entry it needs. */
export async function acknowledgeReminder(
  reminderId: string,
  patientId: string,
  method: AckMethod,
  occurrence?: AppointmentOccurrence,
): Promise<void> {
  const schedule = await db.reminderSchedules.get(reminderId);
  const now = new Date();
  // The patient's local date and wall-clock time, matching how adherence
  // keys an occurrence (reminder id + the date part of this string). An
  // appointment prompt carries its own date, which may not be today's.
  const scheduledAt = occurrence
    ? `${occurrence.date}T${occurrence.time}:00.000Z`
    : schedule
      ? `${localDateString(now)}T${toHHMM(schedule.timeOfDay)}:00.000Z`
      : now.toISOString();

  const ack: LocalReminderAck = {
    id: uuid(),
    reminderId,
    patientId,
    scheduledAt,
    acknowledgedAt: now.toISOString(),
    ackMethod: method,
    synced: false,
  };

  await db.transaction('rw', db.reminderAcks, db.syncQueue, async () => {
    await db.reminderAcks.add(ack);
    await db.syncQueue.add(buildQueueItem('reminder_acks', ack.id, 'insert', { ...ack }));
  });
}
