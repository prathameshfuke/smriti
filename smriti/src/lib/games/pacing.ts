/**
 * Clinical-advice pacing adjustment (issue: games launch too fast for a
 * patient still getting oriented). Applied to each game's own gameplay
 * timing constants — stimulus display time, item/round intervals, response
 * windows, level timers — not to incidental UI feedback (hover/flash
 * transitions) or network timeouts, which stay as designed.
 *
 * Quick Touch is the one exception: it was reported as too slow to feel
 * responsive, so it gets a small speed-up instead of a slow-down.
 */

/** Multiply a duration by this to make it ~20% slower/longer. */
export const SLOWDOWN = 1.2;

/** Multiply Quick Touch's per-item display duration by this to make it ~10% faster/shorter. */
export const QUICK_TAP_SPEEDUP = 0.9;

/** Rounds to the nearest millisecond so downstream `setTimeout`/display math stays on whole numbers. */
function ms(value: number): number {
  return Math.round(value);
}

/** Slows a gameplay-timing constant by {@link SLOWDOWN}. */
export function slower(value: number): number {
  return ms(value * SLOWDOWN);
}

/** Speeds up a Quick Touch timing constant by {@link QUICK_TAP_SPEEDUP}. */
export function quickTapFaster(value: number): number {
  return ms(value * QUICK_TAP_SPEEDUP);
}
