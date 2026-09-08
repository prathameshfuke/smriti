import type { ReminderType } from '@/lib/supabase/types';

export interface AdherenceSchedule {
  id: string;
  reminder_type: ReminderType;
  time_of_day: string;
  days_of_week: number[];
  label: string;
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

export function dateRange(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
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
  const todayStr = now.toISOString().slice(0, 10);
  const currentTimeStr = now.toISOString().slice(11, 16);

  const ackedByReminderAndDate = new Set(
    acks
      .filter((a) => a.acknowledged_at)
      .map((a) => `${a.reminder_id}:${a.scheduled_at.slice(0, 10)}`),
  );

  const byType: Record<string, { acked: number; total: number }> = {};
  const missed: Array<{ date: string; time: string; label: string }> = [];
  let totalAcked = 0;
  let totalExpected = 0;

  for (const schedule of schedules) {
    const type = schedule.reminder_type;
    byType[type] ??= { acked: 0, total: 0 };

    for (const dateStr of days) {
      const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
      if (!schedule.days_of_week.includes(weekday)) continue;

      // A reminder scheduled later today hasn't had a chance to fire yet —
      // counting it as "missed" the moment the day starts made every
      // patient's adherence look worse than reality until each reminder's
      // own time actually passed.
      if (dateStr === todayStr && schedule.time_of_day.slice(0, 5) > currentTimeStr) continue;

      totalExpected += 1;
      byType[type].total += 1;

      const wasAcked = ackedByReminderAndDate.has(`${schedule.id}:${dateStr}`);
      if (wasAcked) {
        totalAcked += 1;
        byType[type].acked += 1;
      } else {
        missed.push({ date: dateStr, time: schedule.time_of_day, label: schedule.label });
      }
    }
  }

  const overallPct = totalExpected > 0 ? Math.round((totalAcked / totalExpected) * 100) : 0;
  return { overallPct, byType, missed };
}
