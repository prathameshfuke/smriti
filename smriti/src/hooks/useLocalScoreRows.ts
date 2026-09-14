'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';
import { SCORE_WINDOW_DAYS, shiftDate, type ScoreRow } from '@/lib/dashboard/cognitiveScore';

/**
 * This phone's own game-day rows for each patient, over the two score
 * windows. The Overview merges them with the server's rows so games played
 * here count straight away, before (or without) a successful sync.
 */
export function useLocalScoreRows(today: string): Record<string, ScoreRow[]> {
  const from = shiftDate(today, -(2 * SCORE_WINDOW_DAYS - 1));
  return (
    useLiveQuery(async () => {
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
    }, [from, today]) ?? {}
  );
}
