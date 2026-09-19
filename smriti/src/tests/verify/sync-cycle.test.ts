import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { v4 as uuid } from 'uuid';
import { db, type LocalPatient } from '@/lib/db/schema';
import { useGameStore } from '@/stores/gameStore';
import { logEvent } from '@/lib/engine/telemetry';
import { acknowledgeReminder, saveReminderSchedules } from '@/lib/engine/reminders';

/**
 * ITEM 3: the full offline -> online cycle. Client side is 100% real (Dexie,
 * sync.ts, gameStore, telemetry). The server side is the REAL
 * src/app/api/sync/route.ts handler, run against an in-memory stand-in for
 * Supabase that enforces what Postgres would: upsert conflict keys,
 * ignoreDuplicates, and the foreign keys telemetry_events.session_id ->
 * game_sessions and reminder_acks.reminder_id -> reminder_schedules.
 * WHAT IS MOCKED: Supabase (PostgREST/RLS/real constraints) and the browser
 * network stack. A real Supabase project is NOT exercised here.
 */

type Row = Record<string, unknown>;
const server = {
  tables: {} as Record<string, Map<string, Row>>,
  calls: [] as string[],
  fail: {} as Record<string, string>, // table -> error message for upserts
  reset() { this.tables = {}; this.calls = []; this.fail = {}; },
  t(name: string) { return (this.tables[name] ??= new Map()); },
};

const CONFLICT_KEYS: Record<string, string[]> = {
  daily_summaries: ['patient_id', 'summary_date', 'game_type'],
};

function fromTable(table: string) {
  const filters: Array<(r: Row) => boolean> = [];
  let op: 'select' | 'upsert' | 'insert' | 'update' = 'select';
  let payload: unknown;
  let opts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  let single = false;

  const run = () => {
    if (op === 'upsert' || op === 'insert') {
      server.calls.push(`${op}:${table}`);
      if (server.fail[table]) return { data: null, error: { message: server.fail[table] } };
      const rows = (Array.isArray(payload) ? payload : [payload]) as Row[];
      for (const r of rows) {
        if (table === 'telemetry_events' && !server.t('game_sessions').has(r.session_id as string)) {
          return { data: null, error: { message: 'FK violation telemetry_events.session_id' } };
        }
        if (table === 'reminder_acks' && !server.t('reminder_schedules').has(r.reminder_id as string)) {
          return { data: null, error: { message: 'FK violation reminder_acks.reminder_id' } };
        }
      }
      for (const r of rows) {
        const keyCols = opts.onConflict ? opts.onConflict.split(',') : (CONFLICT_KEYS[table] ?? ['id']);
        const key = keyCols.map((c) => String(r[c])).join('|');
        if (opts.ignoreDuplicates && server.t(table).has(key)) continue;
        server.t(table).set(key, { ...r });
      }
      return { data: null, error: null };
    }
    if (op === 'update') return { data: null, error: null };
    let rows = [...server.t(table).values()].filter((r) => filters.every((f) => f(r)));
    if (table === 'caregivers') rows = [{ id: 'cg1' }];
    return single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null };
  };

  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = () => chain;
  chain.eq = (c: string, v: unknown) => { filters.push((r) => r[c] === v); return chain; };
  chain.in = (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return chain; };
  chain.gte = (c: string, v: string) => { filters.push((r) => String(r[c] ?? '') >= v); return chain; };
  chain.lt = self; chain.order = self; chain.limit = self;
  chain.upsert = (p: unknown, o: typeof opts = {}) => { op = 'upsert'; payload = p; opts = o; return chain; };
  chain.insert = (p: unknown) => { op = 'insert'; payload = p; return chain; };
  chain.update = () => { op = 'update'; return chain; };
  chain.single = () => { single = true; return Promise.resolve(run()); };
  chain.maybeSingle = chain.single;
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej);
  return chain;
}

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://x/y' } }) }) },
  }),
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user1' } }, error: null }) }, from: fromTable }),
}));

import { POST as syncRoute } from '@/app/api/sync/route';
import { syncAllPatients } from '@/lib/db/sync';

let pid: string;
let clock = Date.parse('2026-09-17T09:00:00.000Z');
const tick = () => { clock += 60_000; vi.setSystemTime(clock); };

function setOnline(v: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value: v, configurable: true });
}
/** fetch -> the real route handler. */
function routeFetch(before?: () => Promise<void> | void) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    await before?.();
    tick(); // route rate-limit is 10 s per user; each test sync is a minute later
    return syncRoute(new Request('http://localhost/api/sync', init));
  });
}

async function seedPatientOnServer() {
  pid = uuid();
  const patient: LocalPatient = {
    id: pid, caregiverId: 'cg1', displayName: 'Aai', ageYears: 72, gender: 'female', educationYears: 4,
    primaryLanguage: 'en', sessionDurationMinutes: 10, isActive: true, currentDifficulty: {},
    updatedAt: '2026-09-01T00:00:00.000Z', syncedAt: null,
  };
  await db.patients.put(patient);
  server.t('patients').set(pid, { id: pid, caregiver_id: 'cg1', display_name: 'Aai', created_at: '2026-01-01T00:00:00.000Z' });
}

/** A finished session of `n` rounds + one reminder schedule + one ack, all written offline. */
async function playOffline(n = 12) {
  useGameStore.getState().startSession(pid);
  for (let i = 0; i < n; i++) {
    await logEvent({
      sessionId: useGameStore.getState().activeSession!.id, patientId: pid, gameType: 'object_hunt',
      difficultyLevel: 2, roundNumber: i + 1, isCorrect: i % 3 !== 0, responseTimeMs: 1000 + i,
      eventTimestamp: new Date(clock).toISOString(), metadata: {},
    });
  }
  await useGameStore.getState().endSession();
  const rid = uuid();
  await saveReminderSchedules([{
    id: rid, patientId: pid, reminderType: 'medication', label: 'Take tablet', timeOfDay: '08:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6], isActive: true, updatedAt: new Date(clock).toISOString(), createdAt: new Date(clock).toISOString(),
  }]);
  await acknowledgeReminder(rid, pid, 'tap');
  return { rid };
}

const unsynced = async () => ({
  sessions: await db.gameSessions.filter((r) => !r.synced).count(),
  events: await db.telemetryEvents.filter((r) => !r.synced).count(),
  summaries: await db.dailySummaries.filter((r) => !r.synced).count(),
  acks: await db.reminderAcks.filter((r) => !r.synced).count(),
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
  server.reset();
  for (const t of ['patients', 'gameSessions', 'telemetryEvents', 'dailySummaries', 'reminderSchedules', 'reminderAcks', 'syncQueue', 'syncCursors'] as const) {
    await db[t].clear();
  }
  useGameStore.setState(useGameStore.getInitialState(), true);
  setOnline(true);
  await seedPatientOnServer();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('ITEM 3: offline -> online sync', () => {
  it('offline: nothing is sent, nothing is lost, queue + unsynced flags persist across a DB reopen', async () => {
    setOnline(false);
    const f = routeFetch(); vi.stubGlobal('fetch', f);
    await playOffline(12);
    expect(await syncAllPatients()).toEqual({ success: false, error: 'offline' });
    expect(f).not.toHaveBeenCalled();
    const before = await unsynced();
    expect(before).toMatchObject({ sessions: 1, events: 12, summaries: 1, acks: 1 });
    const queued = await db.syncQueue.count();
    expect(queued).toBeGreaterThan(0);

    db.close(); await db.open(); // "reload"
    expect(await unsynced()).toEqual(before);
    expect(await db.syncQueue.count()).toBe(queued);
    expect((await db.syncQueue.toArray())[0].payload).toBeTypeOf('object'); // decrypts after reopen
  });

  it('online: one sync delivers server-shaped rows, in FK-safe order, and marks everything synced', async () => {
    await playOffline(12);
    vi.stubGlobal('fetch', routeFetch());
    setOnline(true);
    expect(await syncAllPatients()).toEqual({ success: true });

    expect(server.t('game_sessions').size).toBe(1);
    expect(server.t('telemetry_events').size).toBe(12);
    expect(server.t('reminder_schedules').size).toBe(1);
    expect(server.t('reminder_acks').size).toBe(1);
    const ev = [...server.t('telemetry_events').values()][0];
    expect(Object.keys(ev)).toEqual(expect.arrayContaining(['session_id', 'patient_id', 'game_type', 'is_correct', 'event_timestamp']));
    expect(ev).not.toHaveProperty('sessionId');
    expect(ev).not.toHaveProperty('synced');
    const summary = [...server.t('daily_summaries').values()][0];
    expect(summary).toMatchObject({ total_rounds: 12, correct_rounds: 8, game_type: 'object_hunt' });
    // parents before children
    expect(server.calls.indexOf('upsert:game_sessions')).toBeLessThan(server.calls.indexOf('upsert:telemetry_events'));
    expect(server.calls.indexOf('upsert:reminder_schedules')).toBeLessThan(server.calls.indexOf('upsert:reminder_acks'));
    expect(await unsynced()).toEqual({ sessions: 0, events: 0, summaries: 0, acks: 0 });
  });

  it('HTTP 500 then success: nothing marked synced on failure, no loss, no duplicates after retry', async () => {
    await playOffline(12);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const r1 = await syncAllPatients();
    expect(r1.success).toBe(false);
    expect(await unsynced()).toMatchObject({ sessions: 1, events: 12, summaries: 1, acks: 1 });

    vi.stubGlobal('fetch', routeFetch());
    expect(await syncAllPatients()).toEqual({ success: true });
    expect(server.t('telemetry_events').size).toBe(12);
  });

  it('request timeout (AbortSignal.timeout fires): failure reported, rows stay unsynced', async () => {
    await playOffline(5);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('signal timed out', 'TimeoutError'); }));
    const r = await syncAllPatients();
    expect(r.success).toBe(false);
    expect((await unsynced()).events).toBe(5);
    vi.stubGlobal('fetch', routeFetch());
    expect(await syncAllPatients()).toEqual({ success: true });
    expect(server.t('telemetry_events').size).toBe(5);
  });

  it('HTTP 429 rate limit: waits the server hint once, retries, delivers', async () => {
    await playOffline(4);
    let n = 0;
    const real = routeFetch();
    vi.stubGlobal('fetch', vi.fn(async (u: string, i: RequestInit) => {
      if (n++ === 0) return new Response(JSON.stringify({ error: 'rate_limited', retryAfterMs: 500 }), { status: 429 });
      return real(u, i);
    }));
    vi.useRealTimers(); // the client waits on a real setTimeout
    const started = performance.now();
    const res = await syncAllPatients();
    expect(res).toEqual({ success: true });
    expect(performance.now() - started).toBeGreaterThanOrEqual(450);
    expect(server.t('telemetry_events').size).toBe(4);
  });

  it('server rejects one category (events): sessions get synced, events stay queued, next sync finishes it', async () => {
    await playOffline(6);
    server.fail.telemetry_events = 'CHECK violation';
    vi.stubGlobal('fetch', routeFetch());
    const r = await syncAllPatients();
    expect(r.success).toBe(false);
    expect(await unsynced()).toMatchObject({ sessions: 0, events: 6 });
    server.fail = {};
    expect(await syncAllPatients()).toEqual({ success: true });
    expect(server.t('telemetry_events').size).toBe(6);
    expect((await unsynced()).events).toBe(0);
  });

  it('server rejects the sessions batch: dependent events are NOT marked synced either', async () => {
    await playOffline(6);
    server.fail.game_sessions = 'boom';
    vi.stubGlobal('fetch', routeFetch());
    expect((await syncAllPatients()).success).toBe(false);
    expect(await unsynced()).toMatchObject({ sessions: 1, events: 6 }); // FK made the server refuse events too
    server.fail = {};
    expect(await syncAllPatients()).toEqual({ success: true });
    expect(server.t('telemetry_events').size).toBe(6);
  });

  it('re-sending already-synced rows (lost response, flag reset) is idempotent on the server', async () => {
    await playOffline(12);
    vi.stubGlobal('fetch', routeFetch());
    await syncAllPatients();
    // Simulate "server saved it, response lost": phone still thinks everything is unsynced.
    await db.gameSessions.toCollection().modify({ synced: false });
    await db.telemetryEvents.toCollection().modify({ synced: false });
    await db.dailySummaries.toCollection().modify({ synced: false });
    await db.reminderAcks.toCollection().modify({ synced: false });
    await syncAllPatients();
    expect(server.t('game_sessions').size).toBe(1);
    expect(server.t('telemetry_events').size).toBe(12);
    expect(server.t('daily_summaries').size).toBe(1);
    expect(server.t('reminder_acks').size).toBe(1);
  });

  it('a game round logged WHILE a sync is in flight is not marked synced without having been sent', async () => {
    await playOffline(5);
    const f = routeFetch(async () => {
      // during the request: the patient plays one more round (summary row changes)
      useGameStore.getState().startSession(pid);
      await logEvent({
        sessionId: useGameStore.getState().activeSession!.id, patientId: pid, gameType: 'object_hunt', difficultyLevel: 2,
        roundNumber: 99, isCorrect: true, responseTimeMs: 900, eventTimestamp: new Date(clock).toISOString(), metadata: {},
      });
    });
    vi.stubGlobal('fetch', f);
    await syncAllPatients();
    const localSummary = (await db.dailySummaries.toArray())[0];
    expect(localSummary.totalRounds).toBe(6); // the newer local count survived the response
    expect(localSummary.synced).toBe(false); // ...and is still queued for the next sync
    await syncAllPatients();
    expect([...server.t('daily_summaries').values()][0]).toMatchObject({ total_rounds: 6 });
  });

  it('synced sessions/events/acks do not leave copies in syncQueue forever', async () => {
    await playOffline(12);
    expect(await db.syncQueue.count()).toBeGreaterThan(12); // sessions + events + acks + schedules queued
    vi.stubGlobal('fetch', routeFetch());
    await syncAllPatients();
    expect(await db.syncQueue.count()).toBe(0);
  });
});
