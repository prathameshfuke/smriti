import type { ReminderType } from '@/lib/supabase/types';
import { appointmentOccurrences, occurrenceWindowEnd } from './appointments';

export interface AdherenceSchedule {
  id: string;
  reminder_type: ReminderType;
  time_of_day: string;
  days_of_week: number[];
  label: string;
  /** Days before this are not counted as missed; the reminder did not exist yet. */
  created_at?: string | null;
  /** Dated appointments only (lib/engine/appointments.ts); absent or null otherwise. */
  appointment_date?: string | null;
  remind_day_before_time?: string | null;
  remind_day_of_time?: string | null;
}

export interface AdherenceAck {
  reminder_id: string;
  scheduled_at: string;
  acknowledged_at: string | null;
}

export interface AdherenceResult {
  overallPct: number;
  byType: Record<string, { acked: number; total: number }>;
  missed: Array<{ date: string; time: string; label: string }>;
}

/**
 * Reminder times (`time_of_day`) are the patient's own wall-clock times, so
 * every date and clock comparison here uses the device's local calendar.
 * Comparing "10:00" with the UTC clock made a 10 am reminder in India count
 * as not yet due until 3:30 pm. On the server the local zone is UTC.
 */
export function localDateString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTimeString(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dateRange(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(localDateString(d));
  }
  return dates;
}

/**
 * 7-day reminder adherence, shared by the caregiver-facing adherence
 * breakdown (`/api/patients/[id]/adherence`) and the sync-time low-adherence
 * alert check. Expected occurrences are derived from each active schedule's
 * `days_of_week`, not from ack rows — a missed reminder has no ack row at
 * all, so counting acks alone would silently ignore every miss.
 */
export function computeAdherence(
  schedules: AdherenceSchedule[],
  acks: AdherenceAck[],
  days: string[] = dateRange(7),
): AdherenceResult {
  const now = new Date();
  const todayStr = localDateString(now);
  const currentTimeStr = localTimeString(now);

  const ackedByReminderAndDate = new Set(
    acks
      .filter((a) => a.acknowledged_at)
      .map((a) => `${a.reminder_id}:${a.scheduled_at.slice(0, 10)}`),
  );

  const byType: Record<string, { acked: number; total: number }> = {};
  const missed: Array<{ date: string; time: string; label: string }> = [];
  let totalAcked = 0;
  let totalExpected = 0;

  const count = (schedule: AdherenceSchedule, dateStr: string, time: string) => {
    totalExpected += 1;
    byType[schedule.reminder_type].total += 1;
    if (ackedByReminderAndDate.has(`${schedule.id}:${dateStr}`)) {
      totalAcked += 1;
      byType[schedule.reminder_type].acked += 1;
    } else {
      missed.push({ date: dateStr, time, label: schedule.label });
    }
  };
  const nowStamp = `${todayStr} ${currentTimeStr}`;

  for (const schedule of schedules) {
    const type = schedule.reminder_type;
    byType[type] ??= { acked: 0, total: 0 };
    const created = schedule.created_at ? new Date(schedule.created_at) : null;
    const firstDay = created && !Number.isNaN(created.getTime()) ? localDateString(created) : null;
    const createdTime = firstDay ? localTimeString(created!) : null;

    // A dated appointment is one event with up to two prompts, not a
    // weekday pattern: each prompt counts once, and only after its window
    // has closed, since until then opening the app still shows it.
    if (type === 'appointment' && schedule.appointment_date) {
      const asSchedule = {
        id: schedule.id,
        reminderType: type,
        timeOfDay: schedule.time_of_day,
        appointmentDate: schedule.appointment_date,
        remindDayBeforeTime: schedule.remind_day_before_time ?? undefined,
        remindDayOfTime: schedule.remind_day_of_time ?? undefined,
      } as Parameters<typeof appointmentOccurrences>[0];
      const createdStamp = firstDay ? `${firstDay} ${createdTime}` : null;
      for (const o of appointmentOccurrences(asSchedule)) {
        if (!days.includes(o.date)) continue;
        const windowEnd = occurrenceWindowEnd(asSchedule, o);
        if (windowEnd > nowStamp) continue;
        if (createdStamp && createdStamp >= windowEnd) continue;
        count(schedule, o.date, o.time);
      }
      continue;
    }

    for (const dateStr of days) {
      // A water reminder added on Friday was never "missed" on Monday.
      if (firstDay && dateStr < firstDay) continue;
      const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
      if (!schedule.days_of_week.includes(weekday)) continue;

      // A reminder scheduled later today hasn't had a chance to fire yet —
      // counting it as "missed" the moment the day starts made every
      // patient's adherence look worse than reality until each reminder's
      // own time actually passed.
      if (dateStr === todayStr && schedule.time_of_day.slice(0, 5) > currentTimeStr) continue;
      // Added at 9:30 am: that day's 8 am reminder never had a chance to fire.
      if (dateStr === firstDay && createdTime && schedule.time_of_day.slice(0, 5) < createdTime) continue;

      count(schedule, dateStr, schedule.time_of_day);
    }
  }

  const overallPct = totalExpected > 0 ? Math.round((totalAcked / totalExpected) * 100) : 0;
  return { overallPct, byType, missed };
}
