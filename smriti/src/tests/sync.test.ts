import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor, act } from '@testing-library/react';
import { db } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { encryptCloudField } from '@/lib/memoryBank/cloudCrypto';

const getSession = vi.fn();
const getUser = vi.fn();

/** Chainable Postgrest-like fake: every filter method returns itself, `.single()`
 * and `await` both resolve to the same canned `{ data, error }`. */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'upsert', 'insert', 'update']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

const fromMock = vi.fn((table: string) =>
  makeChain(table === 'caregivers' ? { data: { id: 'c-default' }, error: null } : { data: [], error: null }),
);

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession } }),
  createServerClient: () => ({ auth: { getUser }, from: fromMock }),
}));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

async function seedUnsyncedEvent(id: string, patientId: string) {
  await db.telemetryEvents.put({
    id,
    sessionId: 's1',
    patientId,
    gameType: 'object_hunt',
    difficultyLevel: 1,
    roundNumber: 1,
    isCorrect: true,
    responseTimeMs: 900,
    eventTimestamp: new Date().toISOString(),
    metadata: {},
    synced: false,
  });
}

async function seedUnsyncedSession(id: string, patientId: string) {
  await db.gameSessions.put({
    id,
    patientId,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    synced: false,
  });
}

beforeEach(async () => {
  await db.telemetryEvents.clear();
  await db.dailySummaries.clear();
  await db.reminderAcks.clear();
  await db.gameSessions.clear();
  await db.patients.clear();
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
  getSession.mockReset();
  getUser.mockReset();
  fromMock.mockReset();
  fromMock.mockImplementation((table: string) =>
    makeChain(table === 'caregivers' ? { data: { id: 'c-default' }, error: null } : { data: [], error: null }),
  );
  setOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOfflineStatus', () => {
  it('returns false when navigator.onLine is false', async () => {
    setOnline(false);
    const { useOfflineStatus } = await import('@/hooks/useOfflineStatus');
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOnline).toBe(false);
  });
});

describe('syncToServer', () => {
  it("returns { success:false, error:'offline' } when navigator.onLine=false", async () => {
    setOnline(false);
    const { syncToServer } = await import('@/lib/db/sync');
    const result = await syncToServer('p1');
    expect(result).toEqual({ success: false, error: 'offline' });
  });

  it("returns { success:false, error:'no_session' } when no Supabase session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { syncToServer } = await import('@/lib/db/sync');
    const result = await syncToServer('p1');
    expect(result).toEqual({ success: false, error: 'no_session' });
  });

  it('POSTs correct payload shape when records exist', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
    await seedUnsyncedEvent('e1', 'p1');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        serverTimestamp: new Date().toISOString(),
        syncedEventCount: 1,
        updates: { patients: [], reminders: [], alerts: [] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { syncToServer } = await import('@/lib/db/sync');
    await syncToServer('p1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/sync');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer tok123');

    const body = JSON.parse(options.body);
    expect(body.patients).toHaveLength(1);
    expect(body.patients[0].patientId).toBe('p1');
    expect(body.patients[0].events).toHaveLength(1);
  });

  it('marks records synced=true in Dexie after successful POST', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
    await seedUnsyncedEvent('e2', 'p1');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          serverTimestamp: new Date().toISOString(),
          syncedEventCount: 1,
          updates: { patients: [], reminders: [], alerts: [] },
        }),
      }),
    );

    const { syncToServer } = await import('@/lib/db/sync');
    await syncToServer('p1');

    const row = await db.telemetryEvents.get('e2');
    expect(row?.synced).toBe(true);
  });

  it('returns { success:false } on fetch timeout without throwing', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
    await seedUnsyncedEvent('e3', 'p1');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('The operation was aborted')));

    const { syncToServer } = await import('@/lib/db/sync');
    await expect(syncToServer('p1')).resolves.toMatchObject({ success: false });
  });

  it('only marks the row categories the server actually accepted as synced, leaving rejected ones pending', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
    await seedUnsyncedEvent('e4', 'p1');
    await seedUnsyncedSession('s4', 'p1');

    // Server accepted the event but rejected the session for this patient.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          serverTimestamp: new Date().toISOString(),
          syncedEventCount: 1,
          syncErrors: { p1: { sessions: 'duplicate key value violates unique constraint' } },
          updates: { patients: [], reminders: [], alerts: [] },
        }),
      }),
    );

    const { syncToServer } = await import('@/lib/db/sync');
    const result = await syncToServer('p1');

    expect(result).toEqual({ success: false, error: 'sync rejected for patient(s): p1' });
    expect((await db.telemetryEvents.get('e4'))?.synced).toBe(true);
    expect((await db.gameSessions.get('s4'))?.synced).toBe(false);
  });
});

describe('useSync', () => {
  it('attempts a sync shortly after mounting while already online, not only on an offline->online transition', async () => {
    // The device being online from the very first render is the common
    // case — most sessions never see a real offline->online transition at
    // all. A prior regression only triggered the "just came online" sync on
    // that transition, so an already-online mount never synced anything
    // until either a real transition happened or the 5-minute periodic
    // interval elapsed, which read from the caregiver dashboard as "the app
    // just doesn't sync."
    setOnline(true);
    await db.patients.put({
      id: 'p1',
      caregiverId: 'c1',
      displayName: 'Aai',
      ageYears: 72,
      gender: 'female',
      educationYears: 4,
      primaryLanguage: 'as',
      sessionDurationMinutes: 10,
      isActive: true,
      currentDifficulty: {},
      updatedAt: new Date().toISOString(),
      syncedAt: null,
    });
    await seedUnsyncedEvent('mount-trigger', 'p1');
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ serverTimestamp: new Date().toISOString(), syncedEventCount: 1, syncErrors: {}, updates: { patients: [], reminders: [], alerts: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Real timers, not fake ones: AbortSignal.timeout() (used inside the
    // actual fetch call this is proving happens) does not tolerate Vitest's
    // fake timer patching and silently short-circuits before ever calling
    // fetch, which would make this test pass for the wrong reason.
    const { useSync } = await import('@/hooks/useSync');
    renderHook(() => useSync());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 5000 });
  }, 10000);

  it('pendingCount equals the number of unsynced telemetryEvents in db', async () => {
    await seedUnsyncedEvent('u1', 'p1');
    await seedUnsyncedEvent('u2', 'p1');
    await seedUnsyncedEvent('u3', 'p1');
    usePatientStore.setState({
      currentPatient: {
        id: 'p1',
        caregiverId: 'c1',
        displayName: 'Aai',
        ageYears: 72,
        gender: 'female',
        educationYears: 4,
        primaryLanguage: 'as',
        sessionDurationMinutes: 10,
        isActive: true,
        currentDifficulty: {},
        updatedAt: new Date().toISOString(),
        syncedAt: null,
      },
    });

    const { useSync } = await import('@/hooks/useSync');
    const { result } = renderHook(() => useSync());

    await waitFor(() => expect(result.current.pendingCount).toBe(3));
  });

  it('does not call syncToServer when gameStore.isSessionActive is true', async () => {
    await db.patients.put({
      id: 'p1',
      caregiverId: 'c1',
      displayName: 'Aai',
      ageYears: 72,
      gender: 'female',
      educationYears: 4,
      primaryLanguage: 'as',
      sessionDurationMinutes: 10,
      isActive: true,
      currentDifficulty: {},
      updatedAt: new Date().toISOString(),
      syncedAt: null,
    });
    await seedUnsyncedEvent('sess-guard', 'p1');
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    useGameStore.setState({ isSessionActive: true });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { useSync } = await import('@/hooks/useSync');
    const { result } = renderHook(() => useSync());

    await act(async () => {
      await result.current.syncNow();
    });

    // The connectivity check (`/api/health`) may run; the sync itself must not.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/sync'))).toHaveLength(0);
  });
});

describe('GET /api/health', () => {
  it('returns { ok: true } with 200 status', async () => {
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.timestamp).toBe('number');
  });
});

describe('POST /api/sync', () => {
  it('returns 401 when no Authorization header', async () => {
    const { POST } = await import('@/app/api/sync/route');
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      body: JSON.stringify({ patients: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 429 when called twice within 10 seconds by the same user', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-rate-limit-test' } }, error: null });
    const { POST } = await import('@/app/api/sync/route');

    const makeReq = () =>
      new Request('http://localhost/api/sync', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'd1', lastSyncTimestamp: null, patients: [] }),
      });

    const first = await POST(makeReq());
    expect(first.status).not.toBe(429);

    const second = await POST(makeReq());
    expect(second.status).toBe(429);
  });

  it('does not read or write data for a patientId the caregiver does not own', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-owner-test' } }, error: null });

    const telemetryChain = makeChain({ data: [], error: null });
    const patientsOwnershipChain = makeChain({ data: [], error: null }); // caregiver owns nothing

    fromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c-owner-test' }, error: null });
      if (table === 'patients') return patientsOwnershipChain;
      if (table === 'telemetry_events') return telemetryChain;
      return makeChain({ data: [], error: null });
    });

    const { POST } = await import('@/app/api/sync/route');
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'd1',
        lastSyncTimestamp: null,
        patients: [
          {
            patientId: 'p-foreign',
            sessions: [],
            events: [{ id: 'evt-foreign' }],
            dailySummaries: [],
            reminderAcks: [],
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updates.patients).toEqual([]);
    expect(telemetryChain.upsert).not.toHaveBeenCalled();
  });

  it('reports a rejected upsert in syncErrors instead of silently counting it as synced', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-partial-fail-test' } }, error: null });

    const telemetryChain = makeChain({ data: null, error: { message: 'check constraint violated' } });
    telemetryChain.upsert = vi.fn(() => telemetryChain);

    fromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c-partial-fail-test' }, error: null });
      if (table === 'patients') return makeChain({ data: [{ id: 'p1' }], error: null });
      if (table === 'telemetry_events') return telemetryChain;
      return makeChain({ data: [], error: null });
    });

    const { POST } = await import('@/app/api/sync/route');
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'd1',
        lastSyncTimestamp: null,
        patients: [
          {
            patientId: 'p1',
            sessions: [],
            events: [{ id: 'evt-rejected' }],
            dailySummaries: [],
            reminderAcks: [],
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // A rejected upsert must never inflate the "successfully synced" count.
    expect(body.syncedEventCount).toBe(0);
    expect(body.syncErrors).toEqual({ p1: { events: 'check constraint violated' } });
  });

  it('dedups cognitive-drop alerts against a rolling 48h window, not a calendar-day boundary', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-alert-dedup-test' } }, error: null });

    // Descending by date: today's accuracy is far below a flat 7-day baseline,
    // so detectCognitiveDrop (2 stddev below mean) fires.
    const history = [
      { accuracy_pct: 20, summary_date: '2026-09-06' },
      { accuracy_pct: 90, summary_date: '2026-09-05' },
      { accuracy_pct: 90, summary_date: '2026-09-04' },
      { accuracy_pct: 90, summary_date: '2026-09-03' },
      { accuracy_pct: 90, summary_date: '2026-09-02' },
      { accuracy_pct: 90, summary_date: '2026-09-01' },
      { accuracy_pct: 90, summary_date: '2026-08-31' },
      { accuracy_pct: 90, summary_date: '2026-08-30' },
    ];

    let patientsCallCount = 0;
    const alertsChains: ReturnType<typeof makeChain>[] = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
      if (table === 'patients') {
        patientsCallCount += 1;
        // 1st call: ownership check (array). 2nd call: caregiver_id lookup
        // inside checkCognitiveDropAlert (single object).
        return patientsCallCount === 1
          ? makeChain({ data: [{ id: 'p1' }], error: null })
          : makeChain({ data: { caregiver_id: 'c1' }, error: null });
      }
      if (table === 'daily_summaries') {
        // 1st call: the sync loop's upsert of this patient's dailySummaries.
        // 2nd call: checkCognitiveDropAlert's 8-day history select.
        const chain = makeChain({ data: history, error: null });
        return chain;
      }
      if (table === 'alerts') {
        const chain = makeChain({ data: [], error: null });
        alertsChains.push(chain);
        return chain;
      }
      return makeChain({ data: [], error: null });
    });

    const { POST } = await import('@/app/api/sync/route');
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'd1',
        lastSyncTimestamp: null,
        patients: [
          {
            patientId: 'p1',
            sessions: [],
            events: [],
            dailySummaries: [{ id: 'sum1', gameType: 'object_hunt' }],
            reminderAcks: [],
          },
        ],
      }),
    });

    const before = Date.now();
    await POST(req);

    const dedupChain = alertsChains.find((chain) =>
      (chain.gte as ReturnType<typeof vi.fn>).mock.calls.some((call: unknown[]) => call[0] === 'created_at'),
    );
    expect(dedupChain).toBeDefined();
    const gteCall = (dedupChain!.gte as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === 'created_at',
    );
    const windowStartMs = Date.parse(gteCall![1] as string);

    // A true rolling 48h window: within a few seconds of now-48h, not pinned
    // to the start of today's calendar date (which would be ~hours off).
    expect(Math.abs(windowStartMs - (before - 48 * 60 * 60 * 1000))).toBeLessThan(5000);
  });

  it('inserts a yellow missed_sessions alert when a patient has no sessions in the last 3 days', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-missed-sessions-test' } }, error: null });

    const inserted: Array<Record<string, unknown>> = [];
    let patientsCallCount = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
      if (table === 'patients') {
        patientsCallCount += 1;
        return patientsCallCount === 1
          ? makeChain({ data: [{ id: 'p1' }], error: null })
          : makeChain({ data: { caregiver_id: 'c1' }, error: null });
      }
      // No daily_summaries in the last 3 days -> detectMissedSessions fires.
      if (table === 'daily_summaries') return makeChain({ data: [], error: null });
      if (table === 'alerts') {
        const chain = makeChain({ data: [], error: null }); // no unresolved alert exists yet
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          inserted.push(payload);
          return chain;
        });
        return chain;
      }
      return makeChain({ data: [], error: null });
    });

    const { POST } = await import('@/app/api/sync/route');
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'd1',
        lastSyncTimestamp: null,
        patients: [
          { patientId: 'p1', sessions: [], events: [], dailySummaries: [], reminderAcks: [] },
        ],
      }),
    });

    await POST(req);

    expect(inserted.some((a) => a.alert_type === 'missed_sessions' && a.severity === 'yellow')).toBe(true);
  });

  it('does not insert a second missed_sessions alert while one is already unresolved', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-missed-sessions-dedup-test' } }, error: null });

    const inserted: Array<Record<string, unknown>> = [];
    let patientsCallCount = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
      if (table === 'patients') {
        patientsCallCount += 1;
        return patientsCallCount === 1
          ? makeChain({ data: [{ id: 'p1' }], error: null })
          : makeChain({ data: { caregiver_id: 'c1' }, error: null });
      }
      if (table === 'daily_summaries') return makeChain({ data: [], error: null });
      if (table === 'alerts') {
        // An unresolved missed_sessions alert already exists.
        const chain = makeChain({ data: [{ id: 'existing-alert' }], error: null });
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          inserted.push(payload);
          return chain;
        });
        return chain;
      }
      return makeChain({ data: [], error: null });
    });

    const { POST } = await import('@/app/api/sync/route');
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'd1',
        lastSyncTimestamp: null,
        patients: [
          { patientId: 'p1', sessions: [], events: [], dailySummaries: [], reminderAcks: [] },
        ],
      }),
    });

    await POST(req);

    expect(inserted.some((a) => a.alert_type === 'missed_sessions')).toBe(false);
  });

  it('inserts a yellow low_adherence alert when 7-day reminder adherence is below 50%', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-low-adherence-test' } }, error: null });

    const inserted: Array<Record<string, unknown>> = [];
    let patientsCallCount = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
      if (table === 'patients') {
        patientsCallCount += 1;
        return patientsCallCount === 1
          ? makeChain({ data: [{ id: 'p1' }], error: null })
          : makeChain({ data: { caregiver_id: 'c1' }, error: null });
      }
      // A daily reminder, expected every day, acknowledged 0 times -> 0% adherence.
      if (table === 'reminder_schedules') {
        return makeChain({
          data: [
            {
              id: 'sched1',
              reminder_type: 'medication',
              label: 'Morning pill',
              time_of_day: '00:00',
              days_of_week: [0, 1, 2, 3, 4, 5, 6],
            },
          ],
          error: null,
        });
      }
      if (table === 'reminder_acks') return makeChain({ data: [], error: null });
      if (table === 'alerts') {
        const chain = makeChain({ data: [], error: null });
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          inserted.push(payload);
          return chain;
        });
        return chain;
      }
      return makeChain({ data: [], error: null });
    });

    const { POST } = await import('@/app/api/sync/route');
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'd1',
        lastSyncTimestamp: null,
        patients: [
          { patientId: 'p1', sessions: [], events: [], dailySummaries: [], reminderAcks: [] },
        ],
      }),
    });

    await POST(req);

    expect(inserted.some((a) => a.alert_type === 'low_adherence' && a.severity === 'yellow')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ask Smriti data: Memory Bank pull, consent and offline answers, cursors
// ---------------------------------------------------------------------------
describe('syncToServer — Ask Smriti data', () => {
  // The cloud Memory Bank is end-to-end encrypted: rows arrive as ciphertext
  // under the caregiver's Memory Bank key, which this phone has unlocked.
  const cloudKey = new Uint8Array(32).fill(7);
  const serverEntry = {
    id: 'mb-remote',
    patient_id: 'p1',
    category: 'person',
    title: encryptCloudField(cloudKey, 'mb-remote', 'title', 'Raju'),
    detail: encryptCloudField(cloudKey, 'mb-remote', 'detail', 'Your son. Visits on Sundays.'),
    photo_url: null,
    relationship: encryptCloudField(cloudKey, 'mb-remote', 'relationship', 'son'),
    active: true,
    created_by: 'c1',
    updated_at: '2026-09-10T10:00:00.000Z',
  };

  function okResponse(updates: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        serverTimestamp: '2026-09-17T12:00:00.000Z',
        syncedEventCount: 0,
        syncErrors: {},
        updates: { patients: [], reminders: [], alerts: [], ...updates },
        ...extra,
      }),
    };
  }

  beforeEach(async () => {
    await db.memoryBankEntries.clear();
    await db.consents.clear();
    await db.aiConversationLog.clear();
    await db.syncCursors.clear();
    await db.caregivers.clear();
    await db.caregivers.put({ id: 'c1', authUserId: 'u1', displayName: 'Asha', role: 'family', createdAt: '2026-09-01T00:00:00.000Z' });
    await db.cloudKeys.put({ key: Buffer.from(cloudKey).toString('base64'), savedAt: '2026-09-01T00:00:00.000Z' }, 'c1');
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  });

  it('still syncs with nothing to upload, so changes from other devices arrive', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ memoryBankEntries: [serverEntry] }));
    vi.stubGlobal('fetch', fetchMock);

    const { syncToServer } = await import('@/lib/db/sync');
    const result = await syncToServer('p1');

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const local = await db.memoryBankEntries.get('mb-remote');
    expect(local).toMatchObject({ title: 'Raju', relationship: 'son', patientId: 'p1', synced: true });
    expect((await db.syncCursors.get('p1'))?.serverTimestamp).toBe('2026-09-17T12:00:00.000Z');
  });

  it('without an unlocked key, stores nothing it cannot read and keeps the cursor for later', async () => {
    await db.cloudKeys.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ memoryBankEntries: [serverEntry] })));

    const { syncToServer } = await import('@/lib/db/sync');
    await syncToServer('p1');

    expect(await db.memoryBankEntries.get('mb-remote')).toBeUndefined();
    expect(await db.syncCursors.get('p1')).toBeUndefined();
  });

  it('never uploads a Memory Bank entry in plain text', async () => {
    await db.memoryBankEntries.put({
      id: 'mb-local',
      patientId: 'p1',
      category: 'person',
      title: 'Meena',
      detail: 'Lives at 12 Paona Bazar',
      photoUrl: null,
      relationship: 'daughter',
      active: true,
      createdBy: 'c1',
      updatedAt: '2026-09-18T10:00:00.000Z',
      synced: false,
    });
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const { syncToServer } = await import('@/lib/db/sync');
    await syncToServer('p1');

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string).patients[0].memoryBankEntries;
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent)).not.toMatch(/Meena|Paona|daughter/);
    expect(sent[0].title.startsWith('enc1:')).toBe(true);
  });

  it('holds entries back entirely when this phone has no key', async () => {
    await db.cloudKeys.clear();
    await db.memoryBankEntries.put({
      id: 'mb-local',
      patientId: 'p1',
      category: 'person',
      title: 'Meena',
      detail: 'Lives at 12 Paona Bazar',
      photoUrl: null,
      relationship: 'daughter',
      active: true,
      createdBy: 'c1',
      updatedAt: '2026-09-18T10:00:00.000Z',
      synced: false,
    });
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const { syncToServer } = await import('@/lib/db/sync');
    await syncToServer('p1');

    const body = JSON.stringify(fetchMock.mock.calls.map((c) => c[1]?.body ?? ''));
    expect(body).not.toMatch(/Meena|Paona/);
    expect((await db.memoryBankEntries.get('mb-local'))?.synced).toBe(false);
  });

  it('sends the saved cursor so only changes since the last sync are downloaded', async () => {
    await db.syncCursors.put({ patientId: 'p1', serverTimestamp: '2026-09-16T00:00:00.000Z' });
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const { syncToServer } = await import('@/lib/db/sync');
    await syncToServer('p1');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.patients[0].lastSyncTimestamp).toBe('2026-09-16T00:00:00.000Z');
  });

  it('never lets a server row overwrite a Memory Bank edit this phone has not uploaded yet', async () => {
    await db.memoryBankEntries.put({
      id: 'mb-remote',
      patientId: 'p1',
      category: 'person',
      title: 'Raju',
      detail: 'Visits on Saturdays now.',
      photoUrl: null,
      relationship: 'son',
      active: true,
      createdBy: 'c1',
      updatedAt: '2026-09-09T10:00:00.000Z',
      synced: false,
    });
    // The server rejects the upload, so the local edit stays unsent.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({ memoryBankEntries: [serverEntry] }, { syncErrors: { p1: { memoryBankEntries: 'boom' } } }),
      ),
    );

    const { syncToServer } = await import('@/lib/db/sync');
    await syncToServer('p1');

    expect((await db.memoryBankEntries.get('mb-remote'))?.detail).toBe('Visits on Saturdays now.');
    expect(await db.syncCursors.get('p1')).toBeUndefined();
  });

  it('uploads an unsent consent and offline answers, then marks them sent', async () => {
    await db.consents.put({
      patientId: 'p1',
      version: 2,
      careProfile: true,
      guardianAttested: true,
      aiCompanion: false,
      voiceProcessing: false,
      consentedBy: 'c1',
      consentedAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
      synced: false,
    });
    await db.aiConversationLog.put({
      id: 'offline-1',
      patientId: 'p1',
      question: 'who is Raju',
      answer: 'Raju (son): Your son.',
      grounded: true,
      modelUsed: 'on-device',
      createdAt: '2026-09-15T08:00:00.000Z',
      pendingSync: true,
    });
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const { syncToServer } = await import('@/lib/db/sync');
    await syncToServer('p1');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.patients[0].consent).toMatchObject({ patient_id: 'p1', ai_companion: false, version: 2 });
    expect(body.patients[0].aiConversationLogs).toEqual([
      expect.objectContaining({ id: 'offline-1', model_used: 'on-device', question: 'who is Raju' }),
    ]);
    expect((await db.consents.get('p1'))?.synced).toBe(true);
    expect((await db.aiConversationLog.get('offline-1'))?.pendingSync).toBe(false);
  });
});

describe('POST /api/sync — consent and offline companion answers', () => {
  it('pins consent to the authorized patient and caregiver, and only accepts on-device model names for logs', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-consent-sync-test' } }, error: null });
    const consentChain = makeChain({ data: null, error: null });
    consentChain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const logChain = makeChain({ data: null, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c-real' }, error: null });
      if (table === 'patients') return makeChain({ data: [{ id: 'p1' }], error: null });
      if (table === 'patient_consents') return consentChain;
      if (table === 'ai_conversation_log') return logChain;
      return makeChain({ data: [], error: null });
    });

    const { POST } = await import('@/app/api/sync/route');
    const res = await POST(
      new Request('http://localhost/api/sync', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'd1',
          lastSyncTimestamp: null,
          patients: [
            {
              patientId: 'p1',
              sessions: [],
              events: [],
              dailySummaries: [],
              reminderAcks: [],
              consent: {
                patient_id: 'someone-else',
                caregiver_id: 'forged',
                version: 2,
                care_profile: true,
                guardian_attested: true,
                ai_companion: true,
                voice_processing: true,
                consented_at: '2026-09-01T00:00:00.000Z',
                updated_at: '2026-09-02T00:00:00.000Z',
              },
              aiConversationLogs: [
                {
                  id: '6f1b2c1e-8a47-4d0e-9a55-0d7d0f0c7a11',
                  question: 'who is Raju',
                  answer: 'Raju (son)',
                  grounded: true,
                  model_used: 'groq/pretend',
                  created_at: '2026-09-15T08:00:00.000Z',
                },
              ],
            },
          ],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(consentChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ patient_id: 'p1', caregiver_id: 'c-real', ai_companion: true }),
      { onConflict: 'patient_id' },
    );
    expect(logChain.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ patient_id: 'p1', model_used: 'on-device', flagged_for_followup: false })],
      { onConflict: 'id', ignoreDuplicates: true },
    );
  });
});
