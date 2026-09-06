/**
 * Scoring for the copied double-decision (UFOV-style) game component.
 *
 * This file did not exist in the pasted reference folder — the reference
 * project keeps it at its own repo root (outside `games/double-decision/`),
 * so only the games directory was available to copy from. Written here from
 * the component's call sites: `calculateDoubleDecisionTrialPoints` awards a
 * per-trial score, `calculateDoubleDecisionScore` reduces total points to
 * the single "rating" number shown on the results screen, and the display-ms
 * bounds clamp the speed staircase (faster on a correct answer, slower on a
 * miss). `isDoubleDecisionLeaderboardEligible` always returns false — this
 * app has no leaderboard (see `src/lib/leaderboard.ts`), so nothing is ever
 * "eligible" to submit; the messaging built on top of it was rewritten to
 * describe this app's own per-patient progress tracking instead.
 */

export const DOUBLE_DECISION_MIN_DISPLAY_MS = 150;
export const DOUBLE_DECISION_MAX_DISPLAY_MS = 2000;
export const DOUBLE_DECISION_RULES_VERSION = '1.0';

export function calculateDoubleDecisionTrialPoints({
  correct,
  displayMs,
  fieldLevel,
}: {
  correct: boolean;
  displayMs: number;
  fieldLevel: number;
}): number {
  if (!correct) return 0;
  const speedBonus = Math.round((DOUBLE_DECISION_MAX_DISPLAY_MS - displayMs) / 20);
  return 50 + speedBonus + fieldLevel * 20;
}

export function calculateDoubleDecisionScore(pointsTotal: number, totalTrials: number): number {
  if (totalTrials <= 0) return 0;
  return Math.round(pointsTotal / totalTrials);
}

export function isDoubleDecisionLeaderboardEligible(_args: { accuracy: number; totalTrials: number }): boolean {
  return false;
}
