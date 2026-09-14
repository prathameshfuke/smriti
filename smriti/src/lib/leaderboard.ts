/**
 * Inert no-op. This app's accessibility spec explicitly forbids
 * patient-facing rankings/leaderboards/performance comparison — the
 * reference project's leaderboard submission is dropped, not wired to a
 * backend, kept at the same import path/signature so copied game
 * components don't need editing.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the documented reference-project call shape
export async function submitScoreToLeaderboard(_gameId: string, _score: number, _meta?: Record<string, unknown>): Promise<void> {
  return;
}
