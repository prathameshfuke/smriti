/**
 * Inert stub for the reference project's dual-n-back leaderboard eligibility
 * rules — this app has no leaderboard (see `src/lib/leaderboard.ts`), so
 * eligibility is always false and the gated code path never runs. Kept at
 * the same import path/signatures so the copied game component doesn't
 * need editing.
 */
export const DUAL_N_BACK_CLEAR_MIN_ACCURACY = 90;
export const DUAL_N_BACK_CLEAR_TRAINING_MODE = 'standard';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the documented reference-project signature
export function isDualNBackClearLeaderboardEligible(_settings: unknown): boolean {
  return false;
}
