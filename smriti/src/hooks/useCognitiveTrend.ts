'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';
import { countSessionDays, rowsToPoints, type TrendPoint } from '@/lib/dashboard/trend';

export type TrendRange = '30d' | '90d' | '180d';

const RANGE_DAYS: Record<TrendRange, number> = { '30d': 30, '90d': 90, '180d': 180 };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export interface UseCognitiveTrendResult {
  points: TrendPoint[];
  sessionDays: number;
  isLoading: boolean;
}

/**
 * Reads `db.dailySummaries` for one patient/date-range window entirely
 * client-side — no network round trip, so the cognitive trend chart (and
 * anything else fed by the same `points`, like the per-game breakdown and
 * session calendar) keeps working offline. This is `dexie-react-hooks`'
 * first real use in the app — the package was a declared dependency with no
 * call site until this hook.
 *
 * `dailySummaries` has no plain `patientId` index, only the compound
 * `[patientId+summaryDate+gameType]` (see db/schema.ts) — `.where('patientId')`
 * would throw. Bounding that same compound index with `.between(...)`
 * (rather than a full-table `.toCollection().filter()` scan, the alternative
 * pattern already used in lib/db/sync.ts / hooks/useSync.ts) lets Dexie use
 * the index directly since patientId is pinned equal on both bounds and the
 * gameType component spans its full range ('' to the max BMP codepoint).
 *
 * Cross-device limitation (intentionally not fixed here): `/api/sync`'s
 * response never sends `daily_summaries` back down to Dexie — only
 * patients/reminders/alerts (see lib/db/sync.ts's `SyncResponseBody`). A
 * caregiver opening this patient on a second device that never played
 * locally will see the chart's low-data/empty state indefinitely even
 * though the server has a full history. Fixing that is a sync-layer change
 * out of scope here; this hook stays props-out/no-opinion so a future
 * server-backed source could be swapped in behind the same
 * `UseCognitiveTrendResult` shape without touching the chart component.
 */
export function useCognitiveTrend(patientId: string | null, range: TrendRange): UseCognitiveTrendResult {
  const toDate = isoDate(new Date());
  const fromDate = isoDate(daysAgo(RANGE_DAYS[range] - 1));

  const rows = useLiveQuery(async () => {
    if (!patientId) return [];
    return db.dailySummaries
      .where('[patientId+summaryDate+gameType]')
      .between([patientId, fromDate, ''], [patientId, toDate, '￿'], true, true)
      .toArray();
  }, [patientId, fromDate, toDate]);

  const points = useMemo(() => rowsToPoints(rows ?? []), [rows]);
  const sessionDays = useMemo(() => countSessionDays(points), [points]);

  return { points, sessionDays, isLoading: rows === undefined };
}
