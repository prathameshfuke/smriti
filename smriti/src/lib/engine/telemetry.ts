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
 * Also lazily creates the parent `game_sessions` row on the very first round
 * of a session, and keeps `daily_summaries` current after every round,
 * instead of leaving both to `endSession`. A patient who plays 1-2 rounds
 * and then simply stops — locks the phone, switches apps, closes the tab —
 * without ever tapping "Finish Session" or the nav bar's Back button is the
 * realistic shape of a short session, not an edge case to special-case away.
 * Previously that abandonment meant `endSession` never ran, so:
 *   - `game_sessions` was never written (it was only created inside
 *     `endSession`'s transaction), and syncing the round's own
 *     telemetry_events row without it would fail outright server-side —
 *     `telemetry_events.session_id` is a NOT NULL FK onto `game_sessions`
 *     (docs/03_DATABASE.md) — even though the event itself was safely on
 *     disk locally.
 *   - `daily_summaries` — the one table the caregiver dashboard actually
 *     reads (`/api/patients`, never telemetry_events directly) — was never
 *     built at all, so the played round(s) simply never appeared, sync or
 *     no sync.
 * `endSession` still unconditionally (re)writes the session row (to stamp
 * `endedAt`) and rebuilds the summary when a session *does* end cleanly;
 * this only closes the gap for sessions that never reach that point.
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

  // Deliberately still the one and only await standing between this
  // function starting and `sessionEvents` reflecting it, exactly as before
  // this fix: some pages (see path-match's `finishSession`) read
  // `gameStore.sessionEvents` for same-round adaptive-difficulty scoring
  // right after firing off an unawaited `logEvent(...)`, so every extra
  // `telemetry_events` access this function performs after this point (see
  // `buildDailySummary`'s full re-scan of the table, deliberately NOT used
  // below) risks queuing behind — and so delaying — the *next* round's own
  // `telemetryEvents.put`, on whatever page happens to mount next while this
  // one's tail work is still in flight. That produced exactly this kind of
  // hard-to-explain intermittent failure in
  // `path-match-difficulty-progression.test.tsx` during development.
  await db.telemetryEvents.put(row);
  useGameStore.setState({ sessionEvents: [...sessionEvents, row] });

  // Lazily creates the parent game_sessions row on the very first round of a
  // session, rather than only inside endSession — see this function's doc
  // comment above for why. `put` with the session's own stable id is
  // idempotent, so this is safe to run unguarded by a transaction even
  // against this same function's own overlapping calls (Quick Tap fires
  // several unawaited ones per round, one per displayed item).
  const existingSession = await db.gameSessions.get(activeSession.id);
  const isFirstRoundOfSession = !existingSession;
  if (isFirstRoundOfSession) {
    await db.gameSessions.put(activeSession);
  }

  await bumpDailySummary(row, isFirstRoundOfSession);
}

/**
 * Cheap, incremental sibling of `buildDailySummary` below, run after every
 * round instead of it. Deliberately touches only `daily_summaries` — never
 * `telemetry_events` again — see the comment in `logEvent` above for why:
 * a second `telemetry_events` access here, on every single round, is what
 * actually caused the flakiness, not the general idea of keeping the
 * summary current.
 *
 * `totalRounds`, `correctRounds`, `maxDifficultyReached` and `sessionCount`
 * (using `isNewSession`, precomputed by the caller from the same
 * `game_sessions` lookup it already needed) are all exact running values,
 * cheap to maintain incrementally. `avgResponseTimeMs` is the one exception:
 * computing it exactly needs the count of *non-null* samples contributing
 * to it, which this table doesn't persist, so it's deliberately left as
 * last known good rather than approximated. Any session that ends cleanly
 * still gets one authoritative `buildDailySummary` re-scan (from
 * `endSession`, or a page's own "Finish Session" handler) that recomputes
 * it exactly; a session that never reaches that point keeps a merely-stale
 * `avgResponseTimeMs` on an otherwise fully accurate, fully visible row —
 * which is a real improvement over that row not existing at all.
 */
async function bumpDailySummary(row: LocalTelemetryEvent, isNewSession: boolean): Promise<void> {
  const date = row.eventTimestamp.slice(0, 10);

  await db.transaction('rw', db.dailySummaries, async () => {
    const existing = await db.dailySummaries
      .where('[patientId+summaryDate+gameType]')
      .equals([row.patientId, date, row.gameType])
      .first();

    const summary: LocalDailySummary = {
      id: existing?.id ?? uuid(),
      patientId: row.patientId,
      summaryDate: date,
      gameType: row.gameType,
      totalRounds: (existing?.totalRounds ?? 0) + 1,
      correctRounds: (existing?.correctRounds ?? 0) + (row.isCorrect ? 1 : 0),
      avgResponseTimeMs: existing?.avgResponseTimeMs ?? 0,
      maxDifficultyReached: Math.max(existing?.maxDifficultyReached ?? 0, row.difficultyLevel),
      sessionCount: (existing?.sessionCount ?? 0) + (isNewSession ? 1 : 0),
      eloRating: existing?.eloRating ?? 0,
      synced: false,
    };

    await db.dailySummaries.put(summary);
  });
}

/**
 * Recomputes and upserts the one summary row for a patient/date/gameType
 * from scratch, by re-scanning every matching `telemetry_events` row. The
 * table's primary key is a random `id`, not the compound index, so an
 * existing row must be looked up by `[patientId+summaryDate+gameType]`
 * first — otherwise every call would insert a duplicate summary.
 *
 * This is the authoritative, exact version — called once from `endSession`
 * (over every distinct date/gameType a session touched) and from a few
 * pages' own "Finish Session" handlers — not the one `logEvent` calls after
 * every round (that's the cheaper `bumpDailySummary` above; see its comment
 * for why this heavier, `telemetry_events`-scanning version specifically
 * isn't safe to run that often).
 *
 * The lookup-then-write below is wrapped in one `rw` transaction spanning
 * both tables it touches, so that two overlapping calls for the same key
 * (this and/or `bumpDailySummary` above, which shares the same
 * `daily_summaries` compound-index lookup-then-put shape) can't each read
 * "no existing row" before either writes, then `put()` two different ids
 * for the same key — a duplicate summary the dashboard would double count.
 * Dexie (like native IndexedDB) serializes `rw` transactions that share a
 * table in scope, so wrapping the read-then-write here is what actually
 * guarantees exactly one row per key, not just the common-case appearance
 * of one.
 */
export async function buildDailySummary(
  patientId: string,
  date: string,
  gameType: GameType,
): Promise<LocalDailySummary> {
  return db.transaction('rw', db.telemetryEvents, db.dailySummaries, async () => {
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
  });
}
