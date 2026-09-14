import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/lib/db/schema';
import {
  dedupeDailySummaries,
  toWireDailySummary,
  toWireEvent,
  toWireReminderAck,
  toWireSession,
} from '@/lib/db/wire';

const getSession = vi.fn();
const getUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'upsert', 'insert', 'update']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

const fromMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession } }),
  createServerClient: () => ({ auth: { getUser }, from: fromMock }),
}));

const syncBody = (patients: unknown[]) =>
  new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'd1', lastSyncTimestamp: null, patients }),
  });

beforeEach(async () => {
  await Promise.all([
    db.telemetryEvents.clear(),
    db.gameSessions.clear(),
    db.dailySummaries.clear(),
    db.reminderAcks.clear(),
    db.reminderSchedules.clear(),
    db.syncQueue.clear(),
    db.patients.clear(),
  ]);
  getSession.mockReset();
  getUser.mockReset();
  fromMock.mockReset();
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('wire conversion', () => {
  it('maps a phone telemetry row to column names, dropping the local synced flag', () => {
    const wire = toWireEvent({
      id: 'e1',
      sessionId: 's1',
      patientId: 'p1',
      gameType: 'quick_tap',
      difficultyLevel: 0,
      roundNumber: 2,
      isCorrect: true,
      responseTimeMs: 812.6,
      eventTimestamp: '2026-09-14T08:00:00.000Z',
      metadata: {},
      synced: false,
    });
    expect(wire).toEqual({
      id: 'e1',
      session_id: 's1',
      patient_id: 'p1',
      game_type: 'quick_tap',
      difficulty_level: 1,
      round_number: 2,
      is_correct: true,
      response_time_ms: 813,
      event_timestamp: '2026-09-14T08:00:00.000Z',
      metadata: {},
    });
    expect(wire).not.toHaveProperty('synced');
  });

  it('rounds summary averages for INTEGER columns and treats an unrated elo as null', () => {
    const wire = toWireDailySummary({
      id: 'x',
      patientId: 'p1',
      summaryDate: '2026-09-14',
      gameType: 'frog_leap',
      totalRounds: 3,
      correctRounds: 2,
      avgResponseTimeMs: 1033.3333,
      maxDifficultyReached: 0,
      sessionCount: 0,
      eloRating: 0,
      synced: false,
    });
    expect(wire).toMatchObject({ avg_response_time_ms: 1033, max_difficulty_reached: 1, session_count: 1, elo_rating: null });
    expect(wire.id).toBe('x');
  });

  it('leaves rows that are already snake_case unchanged', () => {
    const row = { id: 's1', patient_id: 'p1', started_at: 'a', ended_at: null, device_id: 'dev' };
    expect(toWireSession(row, 'other')).toEqual(row);
    const ack = { id: 'a1', reminder_id: 'r1', patient_id: 'p1', scheduled_at: 't', acknowledged_at: null, ack_method: null };
    expect(toWireReminderAck(ack)).toEqual(ack);
  });

  it('accepts only UUID ids, so one hand-made row cannot block a batch', async () => {
    const { hasValidIds } = await import('@/lib/db/wire');
    expect(hasValidIds({ id: 'a3bb189e-8bf9-4888-9912-ace4e6543002', session_id: 's1' }, ['id'])).toBe(true);
    expect(hasValidIds({ id: 'a3bb189e-8bf9-4888-9912-ace4e6543002', session_id: 's1' }, ['id', 'session_id'])).toBe(false);
    expect(hasValidIds({ id: 'p1-2026-09-14-quick_tap' }, ['id'])).toBe(false);
  });

  it('keeps one summary per patient, date and game', () => {
    const base = { patient_id: 'p1', summary_date: '2026-09-14', game_type: 'n_back' };
    const rows = dedupeDailySummaries([
      { ...base, total_rounds: 2 } as ReturnType<typeof toWireDailySummary>,
      { ...base, total_rounds: 5 } as ReturnType<typeof toWireDailySummary>,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].total_rounds).toBe(5);
  });
});

describe('POST /api/sync with phone-shaped rows', () => {
  it('upserts converted rows, pinned to the verified patient', async () => {
    const SESSION = '11111111-1111-4111-8111-111111111111';
    const EVENT = '22222222-2222-4222-8222-222222222222';
    const REMINDER = '33333333-3333-4333-8333-333333333333';
    getUser.mockResolvedValue({ data: { user: { id: 'u-wire-convert' } }, error: null });
    const chains: Record<string, ReturnType<typeof makeChain>> = {};
    fromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
      if (table === 'patients') return makeChain({ data: [{ id: 'p1' }], error: null });
      chains[table] ??= makeChain({ data: [], error: null });
      return chains[table];
    });

    const { POST } = await import('@/app/api/sync/route');
    const res = await POST(
      syncBody([
        {
          patientId: 'p1',
          sessions: [{ id: SESSION, patientId: 'p1', startedAt: 't0', endedAt: null, synced: false }],
          events: [
            {
              id: EVENT,
              sessionId: SESSION,
              patientId: 'p-other',
              gameType: 'quick_tap',
              difficultyLevel: 2,
              roundNumber: 1,
              isCorrect: false,
              responseTimeMs: null,
              eventTimestamp: 't1',
              metadata: {},
              synced: false,
            },
          ],
          dailySummaries: [],
          reminderAcks: [],
          reminderSchedules: [
            { id: REMINDER, patientId: 'p1', reminderType: 'hydration', label: 'Drink water', timeOfDay: '10:00', daysOfWeek: [1], isActive: true, updatedAt: 't' },
          ],
        },
      ]),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).syncErrors).toEqual({});
    const eventRows = (chains.telemetry_events.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(eventRows[0]).toMatchObject({ patient_id: 'p1', session_id: SESSION, game_type: 'quick_tap' });
    expect(eventRows[0]).not.toHaveProperty('patientId');
    const sessionRows = (chains.game_sessions.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sessionRows[0]).toMatchObject({ patient_id: 'p1', device_id: 'd1' });
    const scheduleRows = (chains.reminder_schedules.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(scheduleRows[0]).toMatchObject({ id: REMINDER, reminder_type: 'hydration', time_of_day: '10:00' });
  });

  it('reports a patient the account does not have instead of dropping its rows silently', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-wire-missing' } }, error: null });
    fromMock.mockImplementation((table: string) =>
      makeChain(table === 'caregivers' ? { data: { id: 'c1' }, error: null } : { data: [], error: null }),
    );
    const { POST } = await import('@/app/api/sync/route');
    const res = await POST(syncBody([{ patientId: 'p-gone', sessions: [], events: [], dailySummaries: [], reminderAcks: [] }]));
    expect((await res.json()).syncErrors).toEqual({ 'p-gone': { patient: 'patient_not_on_account' } });
  });

  it('tells a rate-limited caller how long to wait', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-wire-rate' } }, error: null });
    fromMock.mockImplementation((table: string) =>
      makeChain(table === 'caregivers' ? { data: { id: 'c1' }, error: null } : { data: [], error: null }),
    );
    const { POST } = await import('@/app/api/sync/route');
    await POST(syncBody([]));
    const second = await POST(syncBody([]));
    expect(second.status).toBe(429);
    const body = await second.json();
    expect(body.retryAfterMs).toBeGreaterThan(0);
    expect(body.retryAfterMs).toBeLessThanOrEqual(10_000);
  });
});

describe('client sync', () => {
  const patient = {
    id: 'p1',
    caregiverId: 'c1',
    displayName: 'Aai',
    ageYears: 72,
    gender: 'female' as const,
    educationYears: 4,
    primaryLanguage: 'hi',
    sessionDurationMinutes: 10,
    isActive: true,
    currentDifficulty: {},
    updatedAt: new Date().toISOString(),
    syncedAt: null,
  };
  const okBody = (syncErrors = {}) => ({
    ok: true,
    status: 200,
    json: async () => ({ serverTimestamp: 'now', syncedEventCount: 0, syncErrors, updates: { patients: [], reminders: [], alerts: [] } }),
  });

  it('waits out a 429 once and then succeeds', async () => {
    await db.patients.put(patient);
    await db.gameSessions.put({ id: 's1', patientId: 'p1', startedAt: 't', endedAt: null, synced: false });
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ retryAfterMs: 500 }) })
      .mockResolvedValueOnce(okBody());
    vi.stubGlobal('fetch', fetchMock);

    const { syncAllPatients } = await import('@/lib/db/sync');
    const result = await syncAllPatients();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true });
    expect((await db.gameSessions.get('s1'))?.synced).toBe(true);
  });

  it('reports a signed-out account as no_session, not a network failure', async () => {
    await db.patients.put(patient);
    await db.gameSessions.put({ id: 's2', patientId: 'p1', startedAt: 't', endedAt: null, synced: false });
    getSession.mockResolvedValue({ data: { session: { access_token: 'expired' } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));

    const { syncAllPatients } = await import('@/lib/db/sync');
    expect(await syncAllPatients()).toEqual({ success: false, error: 'no_session' });
  });

  it('sends reminder schedules waiting in syncQueue and clears the queue once saved', async () => {
    await db.patients.put(patient);
    const { saveReminderSchedules } = await import('@/lib/engine/reminders');
    await saveReminderSchedules([
      { id: 'r1', patientId: 'p1', reminderType: 'hydration', label: 'Drink water', timeOfDay: '10:00', daysOfWeek: [0], isActive: true, updatedAt: 't' },
    ]);
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    const fetchMock = vi.fn().mockResolvedValue(okBody());
    vi.stubGlobal('fetch', fetchMock);

    const { syncAllPatients } = await import('@/lib/db/sync');
    await syncAllPatients();

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.patients[0].reminderSchedules.map((r: { id: string }) => r.id)).toEqual(['r1']);
    expect(sent.patients[0]).not.toHaveProperty('scheduleQueueIds');
    expect(await db.syncQueue.where('tableName').equals('reminder_schedules').count()).toBe(0);
  });

  it('keeps rows pending when the server does not have the patient', async () => {
    await db.patients.put(patient);
    await db.gameSessions.put({ id: 's3', patientId: 'p1', startedAt: 't', endedAt: null, synced: false });
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okBody({ p1: { patient: 'patient_not_on_account' } })));

    const { syncAllPatients } = await import('@/lib/db/sync');
    const result = await syncAllPatients();

    expect(result.success).toBe(false);
    expect((await db.gameSessions.get('s3'))?.synced).toBe(false);
  });
});
