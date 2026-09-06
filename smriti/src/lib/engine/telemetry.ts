import { v4 as uuid } from 'uuid';
import { db, type LocalDailySummary, type LocalTelemetryEvent } from '@/lib/db/schema';
import { useGameStore } from '@/stores/gameStore';
import type { GameType } from '@/lib/supabase/types';

export type TelemetryInput = Omit<LocalTelemetryEvent, 'id' | 'synced'>;

/**
 * Writes one game round straight to Dexie and mirrors it into
 * `gameStore.sessionEvents`, using the same id for both. Unlike
 * `gameStore.logEvent` (which only buffers in memory until `endSession`
 * flushes it), this survives a crash mid-round on flaky 2G/3G — the whole
 * point of an offline-first game. `endSession`'s later bulkPut of the same
 * rows is a harmless no-op re-write, not a duplicate, because the id matches.
 *
 * Mirrors `gameStore`'s own no-active-session guard (droppedEvents) rather
 * than silently writing an orphaned row.
 */
export async function logEvent(event: TelemetryInput): Promise<void> {
  const { activeSession, sessionEvents, droppedEvents } = useGameStore.getState();

  if (!activeSession) {
    console.error('SMRITI: telemetry event logged with no active session', event);
    useGameStore.setState({ droppedEvents: droppedEvents + 1 });
    return;
  }

  const row: LocalTelemetryEvent = { id: uuid(), synced: false, ...event };

  await db.telemetryEvents.put(row);
  useGameStore.setState({ sessionEvents: [...sessionEvents, row] });
}

/**
 * Recomputes and upserts the one summary row for a patient/date/gameType.
 * The table's primary key is a random `id`, not the compound index, so an
 * existing row must be looked up by `[patientId+summaryDate+gameType]`
 * first — otherwise every call would insert a duplicate summary.
 */
export async function buildDailySummary(
  patientId: string,
  date: string,
  gameType: GameType,
): Promise<LocalDailySummary> {
  const events = await db.telemetryEvents
    .where('patientId')
    .equals(patientId)
    .filter((e) => e.gameType === gameType && e.eventTimestamp.startsWith(date))
    .toArray();

  const totalRounds = events.length;
  const correctRounds = events.filter((e) => e.isCorrect).length;
  const responseTimes = events
    .map((e) => e.responseTimeMs)
    .filter((ms): ms is number => ms !== null);
  const avgResponseTimeMs =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, ms) => sum + ms, 0) / responseTimes.length
      : 0;
  const maxDifficultyReached = events.reduce((max, e) => Math.max(max, e.difficultyLevel), 0);
  const sessionCount = new Set(events.map((e) => e.sessionId)).size;

  const existing = await db.dailySummaries
    .where('[patientId+summaryDate+gameType]')
    .equals([patientId, date, gameType])
    .first();

  const summary: LocalDailySummary = {
    id: existing?.id ?? uuid(),
    patientId,
    summaryDate: date,
    gameType,
    totalRounds,
    correctRounds,
    avgResponseTimeMs,
    maxDifficultyReached,
    sessionCount,
    eloRating: existing?.eloRating ?? 0,
    synced: false,
  };

  await db.dailySummaries.put(summary);
  return summary;
}
