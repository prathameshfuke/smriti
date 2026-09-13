'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';
import { computeStreak, type StreakResult } from '@/lib/dashboard/streak';

const LOOKBACK_DAYS = 400;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export interface UseGameStreakResult extends StreakResult {
  isLoading: boolean;
}

/**
 * Reads `db.dailySummaries` for one patient exactly like useCognitiveTrend
 * (same compound-index query, same offline-first/no-network-round-trip
 * contract), bounded to LOOKBACK_DAYS instead of a full-table scan — a
 * streak can only ever break on a real gap, so this bound never truncates a
 * still-unbroken streak short of ~13 months.
 */
export function useGameStreak(patientId: string | null): UseGameStreakResult {
  const today = isoDate(new Date());
  const from = isoDate(daysAgo(LOOKBACK_DAYS));

  const rows = useLiveQuery(async () => {
    if (!patientId) return [];
    return db.dailySummaries
      .where('[patientId+summaryDate+gameType]')
      .between([patientId, from, ''], [patientId, today, '￿'], true, true)
      .toArray();
  }, [patientId, from, today]);

  const streak = useMemo(() => {
    const dates = [...new Set((rows ?? []).map((r) => r.summaryDate))];
    return computeStreak(dates, today);
  }, [rows, today]);

  return { ...streak, isLoading: rows === undefined };
}
