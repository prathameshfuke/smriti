import { v4 as uuid } from 'uuid';
import { db, type LocalMoodLog } from '@/lib/db/schema';

export type MoodValue = LocalMoodLog['value'];

/** Patient's local calendar day, `YYYY-MM-DD` — same shape as `dailySummaries.summaryDate`. */
export function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today's mood log for this patient, or null if not yet answered — the "once per day" gate. */
export async function getTodayMood(patientId: string): Promise<LocalMoodLog | null> {
  const today = todayLocalDate();
  const row = await db.moodLogs.where('[patientId+date]').equals([patientId, today]).first();
  return row ?? null;
}

/**
 * Logs (or overwrites, if tapped twice) today's mood. One row per
 * patient/day — matches by the compound index rather than blind `add()` so
 * a re-tap before the day rolls over updates instead of duplicating.
 */
export async function logMood(patientId: string, value: MoodValue): Promise<LocalMoodLog> {
  const today = todayLocalDate();
  const existing = await db.moodLogs.where('[patientId+date]').equals([patientId, today]).first();
  const row: LocalMoodLog = {
    id: existing?.id ?? uuid(),
    patientId,
    date: today,
    value,
    createdAt: new Date().toISOString(),
    synced: false,
  };
  await db.moodLogs.put(row);
  return row;
}

/** Mood logs for the last `days` calendar days (oldest first), for the dashboard trend strip. */
export async function getMoodHistory(patientId: string, days: number): Promise<LocalMoodLog[]> {
  const rows = await db.moodLogs.where('patientId').equals(patientId).toArray();
  return rows
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}
