import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor, act } from '@testing-library/react';
import { db } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

const getSession = vi.fn();
const getUser = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession } }),
  createServerClient: () => ({ auth: { getUser } }),
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
});

describe('useSync', () => {
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

    expect(fetchMock).not.toHaveBeenCalled();
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

  it('returns 429 when called twice within 30 seconds by the same user', async () => {
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
});
