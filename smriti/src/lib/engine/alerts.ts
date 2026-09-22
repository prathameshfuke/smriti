/**
 * Cognitive-drop detection: today's accuracy vs. a 2-stddev band around the
 * prior 7 days' mean. Pure so it's testable without a live Supabase call —
 * the API route (Task 7a) supplies the 8-value history and does the write.
 */
export function detectCognitiveDrop(history: number[]): boolean {
  if (history.length < 8) return false;

  const [today, ...baseline] = history.slice(0, 8);
  const mean = baseline.reduce((sum, v) => sum + v, 0) / baseline.length;
  const variance = baseline.reduce((sum, v) => sum + (v - mean) ** 2, 0) / baseline.length;
  const stddev = Math.sqrt(variance);

  return today < mean - 2 * stddev;
}

/**
 * True when there is no daily_summaries row for any of the 3 days
 * immediately preceding referenceDate — i.e. 3+ consecutive missed days.
 */
export function detectMissedSessions(summaryDates: string[], referenceDate: Date = new Date()): boolean {
  const dateSet = new Set(summaryDates);
  for (let i = 1; i <= 3; i += 1) {
    const d = new Date(referenceDate);
    d.setUTCDate(d.getUTCDate() - i);
    if (dateSet.has(d.toISOString().slice(0, 10))) return false;
  }
  return true;
}

/** True when 7-day reminder adherence drops below 50%. */
export function detectLowAdherence(overallPct: number): boolean {
  return overallPct < 50;
}

/**
 * True when the 3 most recent calendar days (referenceDateStr back to
 * referenceDateStr-2, inclusive) each have a "low" mood log. Missing a day,
 * or any non-"low" value, breaks the streak — this is a mood *log*, not a
 * screening tool, so it never infers a day the patient didn't check in.
 *
 * `referenceDateStr` is a plain `YYYY-MM-DD` — deliberately not a `Date`
 * with a `new Date()` default. `log_date` (schema.ts's LocalMoodLog /
 * MIGRATION 019) is the patient's *local* calendar day, so the caller must
 * resolve "today" the same way lib/engine/dueCore.ts's `wallClockDate()` +
 * `localDate()` do for reminders (see `checkLowMoodAlert`,
 * src/app/api/sync/route.ts) rather than this function silently defaulting
 * to the server's own UTC clock, which is what caused the original mismatch.
 * Once given the right day, this function only does pure calendar-string
 * arithmetic (`shiftDay`) — no further UTC/local ambiguity to get wrong.
 */
function shiftDay(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function detectLowMoodStreak(
  logs: Array<{ date: string; value: string }>,
  referenceDateStr: string,
  streakLength = 3,
): boolean {
  const byDate = new Map(logs.map((l) => [l.date, l.value]));
  for (let i = 0; i < streakLength; i += 1) {
    if (byDate.get(shiftDay(referenceDateStr, -i)) !== 'low') return false;
  }
  return true;
}
