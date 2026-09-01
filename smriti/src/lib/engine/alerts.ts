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
