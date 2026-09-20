'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';
import { SCORE_WINDOW_DAYS, shiftDate, type ScoreRow } from '@/lib/dashboard/cognitiveScore';

export interface LocalScoreRows {
  rows: Record<string, ScoreRow[]>;
  /** True exactly while the Dexie query has not produced a result yet. */
  isLoading: boolean;
}

/**
 * This phone's own game-day rows for each patient, over the two score
 * windows. The Overview merges them with the server's rows so games played
 * here count straight away, before (or without) a successful sync.
 *
 * `isLoading` is reported separately: coalescing the pending `useLiveQuery`
 * result to `{}` made "still reading the database" indistinguishable from
 * "this phone has no local rows", so a card could paint a server-only score
 * and then silently swap it for the merged one.
 */
export function useLocalScoreRows(today: string): LocalScoreRows {
  const from = shiftDate(today, -(2 * SCORE_WINDOW_DAYS - 1));
  const result = useLiveQuery(async () => {
    const rows = await db.dailySummaries
      .toCollection()
      .filter((r) => r.summaryDate >= from && r.summaryDate <= today && r.totalRounds > 0)
      .toArray();
    const byPatient: Record<string, ScoreRow[]> = {};
    for (const r of rows) {
      (byPatient[r.patientId] ??= []).push({
        date: r.summaryDate,
        gameType: r.gameType,
        correctRounds: r.correctRounds,
        totalRounds: r.totalRounds,
        maxDifficultyReached: r.maxDifficultyReached,
      });
    }
    return byPatient;
  }, [from, today]);

  return { rows: result ?? {}, isLoading: result === undefined };
}
