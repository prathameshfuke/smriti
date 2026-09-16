import { v4 as uuid } from 'uuid';
import { db, type LocalReminderAck, type LocalReminderSchedule } from '@/lib/db/schema';
import { buildQueueItem } from '@/lib/db/syncQueue';
import { toHHMM, type AckMethod } from '@/lib/supabase/types';
import { localDateString } from './adherence';

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


/** Reminders for `patientId` that are due right now and not yet acknowledged today. */
export async function getRemindersDueNow(patientId: string): Promise<LocalReminderSchedule[]> {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  const todayStr = localDateString(now);

  const schedules = await db.reminderSchedules.where('patientId').equals(patientId).toArray();
  const acks = await db.reminderAcks.where('patientId').equals(patientId).toArray();
  const ackedTodayIds = new Set(
    acks
      .filter((a) => a.acknowledgedAt && localDateString(new Date(a.acknowledgedAt)) === todayStr)
      .map((a) => a.reminderId),
  );

  return schedules.filter((s) => {
    if (!s.isActive) return false;
    if (!s.daysOfWeek.includes(today)) return false;
    if (ackedTodayIds.has(s.id)) return false;
    return Math.abs(toMinutes(s.timeOfDay) - nowMinutes) <= DUE_WINDOW_MINUTES;
  });
}

/** Records that a reminder was handled, with the sync-queue entry it needs. */
export async function acknowledgeReminder(
  reminderId: string,
  patientId: string,
  method: AckMethod,
): Promise<void> {
  const schedule = await db.reminderSchedules.get(reminderId);
  const now = new Date();
  const scheduledAt = schedule
    ? // The patient's local date and wall-clock time, matching how adherence
      // keys an occurrence (reminder id + the date part of this string).
      `${localDateString(now)}T${toHHMM(schedule.timeOfDay)}:00.000Z`
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
