'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';
import { computeAdherence, dateRange, type AdherenceResult } from '@/lib/engine/adherence';
import { toAdherenceAck, toAdherenceSchedule } from '@/lib/dashboard/adherenceAdapter';

const RANGE_DAYS = 7;

export interface UseReminderAdherenceResult extends AdherenceResult {
  isLoading: boolean;
}

/**
 * Local-only equivalent of `GET /api/patients/[id]/adherence` — the exact
 * same pure `computeAdherence` the server route uses (lib/engine/adherence.ts),
 * fed from Dexie instead of Postgres so the Reminders tab keeps working
 * offline. `reminderSchedules`/`reminderAcks` both carry a plain `patientId`
 * index (db/schema.ts), unlike `dailySummaries`, so no compound-index
 * workaround is needed here.
 */
export function useReminderAdherence(patientId: string | null): UseReminderAdherenceResult {
  const days = useMemo(() => dateRange(RANGE_DAYS), []);
  const earliest = days[0];

  const raw = useLiveQuery(async () => {
    if (!patientId) return { schedules: [], acks: [] };
    const [schedules, acks] = await Promise.all([
      db.reminderSchedules
        .where('patientId')
        .equals(patientId)
        .filter((s) => s.isActive)
        .toArray(),
      db.reminderAcks
        .where('patientId')
        .equals(patientId)
        .filter((a) => a.scheduledAt >= `${earliest}T00:00:00.000Z`)
        .toArray(),
    ]);
    return { schedules, acks };
  }, [patientId, earliest]);

  const result = useMemo(() => {
    if (!raw) return null;
    return computeAdherence(raw.schedules.map(toAdherenceSchedule), raw.acks.map(toAdherenceAck), days);
  }, [raw, days]);

  return {
    overallPct: result?.overallPct ?? 0,
    byType: result?.byType ?? {},
    missed: result?.missed ?? [],
    isLoading: raw === undefined,
  };
}
