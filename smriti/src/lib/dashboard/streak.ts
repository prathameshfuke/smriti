/**
 * Daily play-streak, pure and framework-free (no Dexie/React import here —
 * `hooks/useGameStreak.ts` is the only thing that reads Dexie and hands
 * dates to this module), mirroring trend.ts's own contract.
 *
 * A streak day is any calendar day with at least one played game round —
 * the same `dailySummaries` row this app already writes for the cognitive
 * trend chart, not a separate "completed the full session" concept.
 */

function addDaysIso(dateIso: string, delta: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export interface StreakResult {
  current: number;
  playedToday: boolean;
}

/**
 * `current` counts back from today (or yesterday, if nothing is logged yet
 * today) through unbroken consecutive calendar days. A gap of even one day
 * resets it to 0 — no grace window, so the number always means exactly what
 * it says. This function only ever reports a count; it never renders a
 * "you lost your streak" message — callers are responsible for framing a
 * reset positively, since the patient audience this app serves shouldn't
 * see a missed day read as a failure.
 */
export function computeStreak(sessionDates: string[], todayIso: string): StreakResult {
  const dates = new Set(sessionDates);
  const playedToday = dates.has(todayIso);

  let cursor = playedToday ? todayIso : addDaysIso(todayIso, -1);
  let current = 0;
  while (dates.has(cursor)) {
    current += 1;
    cursor = addDaysIso(cursor, -1);
  }

  return { current, playedToday };
}
