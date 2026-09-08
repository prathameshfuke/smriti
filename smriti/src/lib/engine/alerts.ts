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
