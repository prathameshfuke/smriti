export interface RecallScore {
  hits: number;
  misses: number;
  falseAlarms: number;
}

/** Word Stream's delayed-recall scoring: hits/misses/false alarms from a selection. */
export function scoreRecall(original: string[], selected: Set<string>): RecallScore {
  const hits = original.filter((id) => selected.has(id)).length;
  const misses = original.filter((id) => !selected.has(id)).length;
  const falseAlarms = [...selected].filter((id) => !original.includes(id)).length;
  return { hits, misses, falseAlarms };
}

export interface QuickTapItemResult {
  isTarget: boolean;
  tapped: boolean;
}

export interface QuickTapRoundScore {
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejects: number;
}

/** Quick Tap's per-item classification, tallied for a full round. */
export function scoreQuickTapRound(items: QuickTapItemResult[]): QuickTapRoundScore {
  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  let correctRejects = 0;

  for (const item of items) {
    if (item.isTarget && item.tapped) hits += 1;
    else if (item.isTarget && !item.tapped) misses += 1;
    else if (!item.isTarget && item.tapped) falseAlarms += 1;
    else correctRejects += 1;
  }

  return { hits, misses, falseAlarms, correctRejects };
}

/**
 * Simplified Z-approximation of d-prime (signal detection sensitivity).
 * Rates are clamped to [0.01, 0.99] so a perfect or zero score never blows
 * up the linear approximation.
 */
export function computeDPrime(
  hits: number,
  totalTargets: number,
  falseAlarms: number,
  totalNonTargets: number,
): number {
  const clamp = (n: number) => Math.max(0.01, Math.min(0.99, n));
  const hitRate = clamp(totalTargets > 0 ? hits / totalTargets : 0.01);
  const falseAlarmRate = clamp(totalNonTargets > 0 ? falseAlarms / totalNonTargets : 0.01);
  return (hitRate - 0.5) * 5.55 - (falseAlarmRate - 0.5) * 5.55;
}

/**
 * Hit rate with each wrong pick taking one correct pick back, floored at 0.
 * Plain hits/total let a patient tap everything and still score 100%
 * (issue #4: wrong options in Market List / Quick Tap had no effect).
 */
export function penalizedAccuracy(hits: number, falseAlarms: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (hits - falseAlarms) / total));
}

/** Converts a 0-1 success rate into a 1-5 star rating; never rounds down to 0. */
export function starsFromRate(rate: number): number {
  return Math.max(1, Math.min(5, Math.round(rate * 5)));
}
