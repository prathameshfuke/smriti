import type { GameType } from '@/lib/supabase/types';
import { MAX_LEVEL } from '@/lib/engine/difficulty';
import { GAME_LABELS } from './gameLabels';
import type { TrendPoint } from './trend';

export interface GameBreakdownRow {
  gameType: GameType;
  label: string;
  accuracy: number;
  maxDifficultyReached: number;
  maxLevel: number;
  lastPlayed: string;
  sessionCount: number;
  totalRounds: number;
}

/**
 * One row per game played across the given points, rounds-weighted the same
 * way as the trend line's daily blend (see lib/dashboard/trend.ts's
 * `aggregateDailyBlended`) — a game played for 3 rounds should not move its
 * own bar as much as one played for 30. Labels and level caps are pulled
 * from the single shared sources (`gameLabels.ts`, `lib/engine/difficulty.ts`)
 * rather than a new copy.
 */
export function aggregateByGame(points: TrendPoint[]): GameBreakdownRow[] {
  const byGame = new Map<
    GameType,
    {
      correctRounds: number;
      totalRounds: number;
      maxDifficultyReached: number;
      lastPlayed: string;
      sessionCount: number;
    }
  >();

  for (const p of points) {
    const entry = byGame.get(p.gameType) ?? {
      correctRounds: 0,
      totalRounds: 0,
      maxDifficultyReached: 0,
      lastPlayed: p.date,
      sessionCount: 0,
    };
    entry.correctRounds += (p.accuracy / 100) * p.totalRounds;
    entry.totalRounds += p.totalRounds;
    entry.maxDifficultyReached = Math.max(entry.maxDifficultyReached, p.maxDifficultyReached);
    entry.lastPlayed = p.date > entry.lastPlayed ? p.date : entry.lastPlayed;
    entry.sessionCount += p.sessionCount;
    byGame.set(p.gameType, entry);
  }

  return [...byGame.entries()].map(([gameType, e]) => ({
    gameType,
    label: GAME_LABELS[gameType],
    accuracy: e.totalRounds > 0 ? (e.correctRounds / e.totalRounds) * 100 : 0,
    maxDifficultyReached: e.maxDifficultyReached,
    maxLevel: MAX_LEVEL[gameType],
    lastPlayed: e.lastPlayed,
    sessionCount: e.sessionCount,
    totalRounds: e.totalRounds,
  }));
}
