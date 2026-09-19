import type { GameType } from '@/lib/supabase/types';
import type { LocalDailySummary } from '@/lib/db/schema';
import type { ScoreRow } from '@/lib/dashboard/cognitiveScore';

/**
 * Cognitive-trend data, pure and framework-free (no React, no Dexie import
 * here — `hooks/useCognitiveTrend.ts` is the only thing that reads Dexie and
 * hands rows to this module).
 *
 * `accuracy` is derived, never stored: Postgres's `daily_summaries` table has
 * `accuracy_pct` as a generated column, but the local Dexie mirror only ever
 * carries `correctRounds`/`totalRounds` (see db/schema.ts). It is kept as an
 * UNROUNDED float on purpose — `aggregateDailyBlended` below recovers the
 * exact `correctRounds` via `accuracy / 100 * totalRounds`, which is only
 * lossless if `accuracy` itself was never rounded first. Round only at
 * render time (`Math.round`), never here.
 */
export interface TrendPoint {
  date: string;
  accuracy: number;
  gameType: GameType;
  maxDifficultyReached: number;
  sessionCount: number;
  totalRounds: number;
}

export function summaryToPoint(row: LocalDailySummary): TrendPoint {
  return {
    date: row.summaryDate,
    accuracy: row.totalRounds > 0 ? (row.correctRounds / row.totalRounds) * 100 : 0,
    // Written exclusively through lib/engine/telemetry.ts's buildDailySummary,
    // whose `gameType` parameter is already the canonical GameType — this
    // cast documents that invariant rather than re-deriving it.
    gameType: row.gameType as GameType,
    maxDifficultyReached: row.maxDifficultyReached,
    sessionCount: row.sessionCount,
    totalRounds: row.totalRounds,
  };
}

export function rowsToPoints(rows: LocalDailySummary[]): TrendPoint[] {
  return rows.map(summaryToPoint);
}

/**
 * Adds the server's game-day rows (what `/api/patients` sends for a patient)
 * to this device's own points, so a caregiver on a different phone from the
 * patient still sees a trend, calendar and streak. A game-day present in both
 * keeps whichever copy has more rounds (same rule as `mergeScoreRows`). The
 * server rows carry no session count, so those days count as one session.
 */
export function mergeServerPoints(
  local: TrendPoint[],
  serverRows: ScoreRow[] | undefined,
  fromDate: string,
  toDate: string,
): TrendPoint[] {
  if (!serverRows || serverRows.length === 0) return local;
  const byKey = new Map<string, TrendPoint>();
  for (const p of local) byKey.set(`${p.date}|${p.gameType}`, p);
  for (const r of serverRows) {
    if (r.totalRounds <= 0 || r.date < fromDate || r.date > toDate) continue;
    const key = `${r.date}|${r.gameType}`;
    const existing = byKey.get(key);
    if (existing && existing.totalRounds >= r.totalRounds) continue;
    byKey.set(key, {
      date: r.date,
      accuracy: (r.correctRounds / r.totalRounds) * 100,
      gameType: r.gameType as GameType,
      maxDifficultyReached: r.maxDifficultyReached,
      sessionCount: existing?.sessionCount ?? 1,
      totalRounds: r.totalRounds,
    });
  }
  return [...byKey.values()];
}

/**
 * Distinct calendar days represented, regardless of how many games were
 * played on each. This — not `points.length`, which counts one row per
 * (date, game) pair — is what "N sessions so far" means for the low-data
 * gate in `getTrendState`.
 */
export function countSessionDays(points: TrendPoint[]): number {
  return new Set(points.map((p) => p.date)).size;
}

export interface BlendedDailyPoint {
  date: string;
  accuracy: number;
  totalRounds: number;
  sessionCount: number;
  maxDifficultyReached: number;
}

/**
 * One row per calendar day, blending every game played that day into a
 * single rounds-weighted accuracy: sum(correctRounds) / sum(totalRounds) *
 * 100 — NOT a plain mean of each game's own daily accuracy. An unweighted
 * mean counts a 3-round game the same as a 30-round one (the bug in the old
 * page.tsx `velocity` calculation this replaces), which can swing the
 * headline number on a day the patient barely played anything.
 */
export function aggregateDailyBlended(points: TrendPoint[]): BlendedDailyPoint[] {
  const byDate = new Map<
    string,
    { correctRounds: number; totalRounds: number; sessionCount: number; maxDifficultyReached: number }
  >();

  for (const p of points) {
    const entry = byDate.get(p.date) ?? {
      correctRounds: 0,
      totalRounds: 0,
      sessionCount: 0,
      maxDifficultyReached: 0,
    };
    entry.correctRounds += (p.accuracy / 100) * p.totalRounds;
    entry.totalRounds += p.totalRounds;
    entry.sessionCount += p.sessionCount;
    entry.maxDifficultyReached = Math.max(entry.maxDifficultyReached, p.maxDifficultyReached);
    byDate.set(p.date, entry);
  }

  return [...byDate.entries()]
    .map(([date, e]) => ({
      date,
      accuracy: e.totalRounds > 0 ? (e.correctRounds / e.totalRounds) * 100 : 0,
      totalRounds: e.totalRounds,
      sessionCount: e.sessionCount,
      maxDifficultyReached: e.maxDifficultyReached,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type TrendRenderState = 'empty' | 'low-data' | 'trend';

/**
 * Gates which of `CognitiveTrendChart`'s 4 render states applies (the 4th,
 * `isLoading`, is a separate concern the chart checks first). Default
 * `minSessionsForTrend` of 5 sits below `detectCognitiveDrop`'s own 8-point
 * floor (lib/engine/alerts.ts) and the ~14 days `classifyVelocity` wants, but
 * is still enough that a 1-2 session blip cannot be drawn as if it were a
 * real trend line.
 */
export function getTrendState(sessionDays: number, minSessionsForTrend: number): TrendRenderState {
  if (sessionDays === 0) return 'empty';
  if (sessionDays < minSessionsForTrend) return 'low-data';
  return 'trend';
}

export interface AccuracyDrop {
  date: string;
  delta: number;
}

/** A fall this steep is the clinical signal the dashboard exists to surface — same threshold ScoreGraph used per-game, now applied to the one blended line. */
const DROP_THRESHOLD_PCT = 15;

/**
 * Day-over-day drops on the blended series steeper than `DROP_THRESHOLD_PCT`.
 * Callers should only surface this in the full `'trend'` state — a 2-point
 * slope in `'low-data'` is not a real trend, and flagging it manufactures a
 * false alarm.
 */
export function findAccuracyDrops(daily: BlendedDailyPoint[]): AccuracyDrop[] {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const drops: AccuracyDrop[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const delta = sorted[i - 1].accuracy - sorted[i].accuracy;
    if (delta > DROP_THRESHOLD_PCT) {
      drops.push({ date: sorted[i].date, delta });
    }
  }
  return drops;
}

export interface VelocityResult {
  label: string;
  direction: 'up' | 'down' | 'stable';
}

/**
 * Last-7-vs-previous-7-day blended accuracy. Replaces page.tsx's old
 * per-row unweighted mean with the same rounds-weighted blend the chart
 * line itself uses (see `aggregateDailyBlended`). Needs both windows
 * populated (effectively ~14 days of history) or returns null, matching the
 * original behavior of hiding the "Cognitive Trend" card until then.
 */
export function classifyVelocity(daily: BlendedDailyPoint[]): VelocityResult | null {
  const last7 = daily.slice(-7);
  const prev7 = daily.slice(-14, -7);
  if (last7.length === 0 || prev7.length === 0) return null;

  const weightedAvg = (rows: BlendedDailyPoint[]): number => {
    const totalRounds = rows.reduce((sum, r) => sum + r.totalRounds, 0);
    if (totalRounds === 0) return 0;
    const correctRounds = rows.reduce((sum, r) => sum + (r.accuracy / 100) * r.totalRounds, 0);
    return (correctRounds / totalRounds) * 100;
  };

  const last7Avg = weightedAvg(last7);
  const prev7Avg = weightedAvg(prev7);

  if (last7Avg > prev7Avg + 5) return { label: '↑ Improving', direction: 'up' };
  if (last7Avg < prev7Avg - 5) return { label: '↓ Declining', direction: 'down' };
  return { label: '→ Stable', direction: 'stable' };
}
