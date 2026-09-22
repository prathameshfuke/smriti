import { v4 as uuid } from 'uuid';
import { db, type LocalMoodLog } from '@/lib/db/schema';

export type MoodValue = LocalMoodLog['value'];

/** Patient's local calendar day, `YYYY-MM-DD` — same shape as `dailySummaries.summaryDate`. */
export function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Pure calendar-string arithmetic on a `YYYY-MM-DD` value — never touches
 * the clock, so it can't reintroduce the UTC/local mismatch `shiftDay` in
 * lib/engine/alerts.ts was written to avoid. */
function shiftLocalDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Which of the `count` consoling clips (lib/audio/consoling.ts) to play for
 * today's "low" log — random, except it never repeats yesterday's clip if
 * yesterday was also logged "low", so two low days in a row don't hear the
 * exact same line. Pure local Dexie read, works offline.
 */
export async function pickConsolingClipIndex(patientId: string, count: number): Promise<number> {
  if (count <= 1) return 0;
  const yesterday = await db.moodLogs.where('[patientId+date]').equals([patientId, shiftLocalDate(todayLocalDate(), -1)]).first();
  const avoid = yesterday?.value === 'low' ? yesterday.consolingClipIndex : undefined;
  let index = Math.floor(Math.random() * count);
  if (avoid !== undefined) {
    // count > 1 here, so this always terminates.
    while (index === avoid) index = Math.floor(Math.random() * count);
  }
  return index;
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
export async function logMood(patientId: string, value: MoodValue, consolingClipIndex?: number): Promise<LocalMoodLog> {
  const today = todayLocalDate();
  const build = (id: string): LocalMoodLog => ({
    id,
    patientId,
    date: today,
    value,
    createdAt: new Date().toISOString(),
    synced: false,
    ...(consolingClipIndex !== undefined ? { consolingClipIndex } : {}),
  });
  const existing = await db.moodLogs.where('[patientId+date]').equals([patientId, today]).first();
  try {
    const row = build(existing?.id ?? uuid());
    await db.moodLogs.put(row);
    return row;
  } catch (err) {
    // `[patientId+date]` is unique (schema.ts) — a second near-simultaneous
    // call can lose this race after both read "no existing row". Its own
    // fresh id then collides on the unique index instead of the primary
    // key, so `put` throws rather than quietly overwriting. Re-read the
    // row that won and overwrite that one instead of failing the tap.
    if (!(err instanceof Error) || err.name !== 'ConstraintError') throw err;
    const winner = await db.moodLogs.where('[patientId+date]').equals([patientId, today]).first();
    if (!winner) throw err;
    const row = build(winner.id);
    await db.moodLogs.put(row);
    return row;
  }
}

/** Mood logs for the last `days` calendar days (oldest first), for the dashboard trend strip. */
export async function getMoodHistory(patientId: string, days: number): Promise<LocalMoodLog[]> {
  const rows = await db.moodLogs.where('patientId').equals(patientId).toArray();
  return rows
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}
