import type { GameType } from '@/lib/supabase/types';
import { MAX_LEVEL } from '@/lib/engine/difficulty';

/**
 * A single 0-100 "cognitive score" for how a patient is doing in the games,
 * so a caregiver has one number to follow week to week. Pure and
 * framework-free: the server route (`/api/patients`, Supabase rows) and the
 * patient page (Dexie trend points) both feed it the same shape.
 *
 * It is an engagement-and-performance summary, not a clinical measure, and
 * the UI says so wherever it appears.
 *
 * score = 60% accuracy + 25% level reached + 15% regular play
 *
 * - accuracy: rounds-weighted over the window (a 3-round game never counts
 *   as much as a 30-round one; same rule as `aggregateDailyBlended`).
 * - level: for each game played, highest level reached / that game's cap,
 *   averaged. Games with no levels (cap 1) are left out.
 * - regular play: distinct days played, full marks at 10 of 14 days.
 */

export interface ScoreRow {
  date: string;
  gameType: GameType | string;
  correctRounds: number;
  totalRounds: number;
  maxDifficultyReached: number;
}

export type ScoreBand = 'strong' | 'steady' | 'support' | 'close-support';

export interface CognitiveScore {
  score: number;
  accuracy: number;
  level: number;
  regularity: number;
  daysPlayed: number;
  /**
   * True when no levelled game was played in the window, so `level` is a
   * copy of `accuracy` (the fallback below) rather than a real measurement.
   * The UI must NOT print it as "N% of top level" in that case — two
   * identical-looking numbers that are in fact one number.
   */
  levelFromAccuracy: boolean;
  /** Fewer than 3 days played: the number is shown, marked as an early estimate. */
  enoughData: boolean;
  previousScore: number | null;
  delta: number | null;
  band: ScoreBand;
}

export const SCORE_WINDOW_DAYS = 14;
const FULL_REGULARITY_DAYS = 10;
const MIN_DAYS_FOR_SCORE = 3;

export const BAND_LABEL: Record<ScoreBand, string> = {
  strong: 'Strong',
  steady: 'Steady',
  support: 'Needs support',
  'close-support': 'Needs close support',
};

export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'steady';
  if (score >= 40) return 'support';
  return 'close-support';
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface WindowScore {
  score: number;
  accuracy: number;
  level: number;
  regularity: number;
  daysPlayed: number;
  levelFromAccuracy: boolean;
}

function scoreWindow(rows: ScoreRow[]): WindowScore | null {
  const played = rows.filter((r) => r.totalRounds > 0);
  if (played.length === 0) return null;

  let correct = 0;
  let total = 0;
  const bestLevel = new Map<string, number>();
  const days = new Set<string>();

  for (const r of played) {
    correct += r.correctRounds;
    total += r.totalRounds;
    days.add(r.date);
    bestLevel.set(r.gameType, Math.max(bestLevel.get(r.gameType) ?? 0, r.maxDifficultyReached));
  }

  const accuracy = total > 0 ? (correct / total) * 100 : 0;

  const levelRatios: number[] = [];
  for (const [gameType, level] of bestLevel) {
    const cap = MAX_LEVEL[gameType as GameType];
    if (!cap || cap <= 1) continue;
    levelRatios.push(Math.min(1, Math.max(0, level / cap)));
  }
  // No levelled game played yet: fall back to accuracy so a quiz-only
  // fortnight is not dragged down by a component it could not earn.
  const level = levelRatios.length > 0 ? (levelRatios.reduce((a, b) => a + b, 0) / levelRatios.length) * 100 : accuracy;

  const regularity = Math.min(1, days.size / FULL_REGULARITY_DAYS) * 100;
  const score = Math.round(0.6 * accuracy + 0.25 * level + 0.15 * regularity);

  return {
    score: Math.max(0, Math.min(100, score)),
    accuracy,
    level,
    regularity,
    daysPlayed: days.size,
    levelFromAccuracy: levelRatios.length === 0,
  };
}

/**
 * Score over the `SCORE_WINDOW_DAYS` ending `today` (inclusive), compared
 * with the window before it. Null when nothing was played in the window.
 */
export function computeCognitiveScore(rows: ScoreRow[], today: string): CognitiveScore | null {
  const from = shiftDate(today, -(SCORE_WINDOW_DAYS - 1));
  const prevFrom = shiftDate(today, -(2 * SCORE_WINDOW_DAYS - 1));
  const current = scoreWindow(rows.filter((r) => r.date >= from && r.date <= today));
  if (!current) return null;

  const previous = scoreWindow(rows.filter((r) => r.date >= prevFrom && r.date < from));
  const previousScore = previous && previous.daysPlayed >= MIN_DAYS_FOR_SCORE ? previous.score : null;

  return {
    ...current,
    enoughData: current.daysPlayed >= MIN_DAYS_FOR_SCORE,
    previousScore,
    delta: previousScore === null ? null : current.score - previousScore,
    band: scoreBand(current.score),
  };
}

export interface DayActivity {
  date: string;
  /** Rounds-weighted accuracy that day, or null if nothing was played. */
  accuracy: number | null;
}

/**
 * Combines the same patient's rows from two sources (this phone's Dexie and
 * the server). A game-day present in both keeps whichever copy has more
 * rounds: the phone is ahead of the server until it syncs, the server is
 * ahead when another phone played.
 */
export function mergeScoreRows(...sources: ScoreRow[][]): ScoreRow[] {
  const byKey = new Map<string, ScoreRow>();
  for (const rows of sources) {
    for (const row of rows) {
      const key = `${row.date}|${row.gameType}`;
      const existing = byKey.get(key);
      if (!existing || row.totalRounds > existing.totalRounds) byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

export interface PatientActivitySummary {
  score: CognitiveScore | null;
  /** Rounds-weighted accuracy today, or null when nothing was played today. */
  accuracyToday: number | null;
  daysPlayedThisWeek: number;
  week: Array<number | null>;
}

/** Everything the Overview card shows for one patient, from one set of rows. */
export function summarizeActivity(rows: ScoreRow[], today: string): PatientActivitySummary {
  const week = recentActivity(rows, today, 7);
  const todayAccuracy = week[6].accuracy;
  return {
    score: computeCognitiveScore(rows, today),
    accuracyToday: todayAccuracy === null ? null : Math.round(todayAccuracy),
    daysPlayedThisWeek: week.filter((d) => d.accuracy !== null).length,
    week: week.map((d) => (d.accuracy === null ? null : Math.round(d.accuracy))),
  };
}

/** The last `days` calendar days ending `today`, oldest first, one entry per day. */
export function recentActivity(rows: ScoreRow[], today: string, days = 7): DayActivity[] {
  const byDate = new Map<string, { correct: number; total: number }>();
  for (const r of rows) {
    if (r.totalRounds <= 0) continue;
    const e = byDate.get(r.date) ?? { correct: 0, total: 0 };
    e.correct += r.correctRounds;
    e.total += r.totalRounds;
    byDate.set(r.date, e);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDate(today, i - (days - 1));
    const e = byDate.get(date);
    return { date, accuracy: e && e.total > 0 ? (e.correct / e.total) * 100 : null };
  });
}
