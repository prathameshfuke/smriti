import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db, type LocalPatient } from '@/lib/db/schema';

const getSession = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession } }),
}));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

function patient(over: Partial<LocalPatient> = {}): LocalPatient {
  return {
    id: 'p1',
    caregiverId: 'c1',
    displayName: 'Asha',
    ageYears: 72,
    gender: 'female',
    educationYears: 8,
    primaryLanguage: 'hi',
    sessionDurationMinutes: 10,
    isActive: true,
    currentDifficulty: { object_hunt: 3 },
    updatedAt: '2026-01-01T00:00:00.000Z',
    syncedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function okResponse(body: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      serverTimestamp: '2026-02-01T00:00:00.000Z',
      syncedEventCount: 0,
      updates: { patients: [], reminders: [], alerts: [] },
      ...body,
    }),
  };
}

beforeEach(async () => {
  await db.patients.clear();
  await db.telemetryEvents.clear();
  await db.syncState.clear();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
  setOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sync failure state', () => {
  it('records the failure count and the last error so the UI can say why', async () => {
    await db.patients.put(patient());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { syncAllPatients, getSyncState } = await import('@/lib/db/sync');
    await syncAllPatients();
    await syncAllPatients();

    const state = await getSyncState();
    expect(state.consecutiveFailures).toBe(2);
    expect(state.lastError).toContain('network down');
  });

  it('clears the failure count after a success and remembers when it happened', async () => {
    await db.patients.put(patient());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { syncAllPatients, getSyncState } = await import('@/lib/db/sync');
    await syncAllPatients();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    await syncAllPatients();

    const state = await getSyncState();
    expect(state.consecutiveFailures).toBe(0);
    expect(state.lastError).toBeNull();
    expect(state.lastSyncedAt).not.toBeNull();
  });

  it('a partial rejection is a failure, not a success with a fresh timestamp', async () => {
    await db.patients.put(patient());
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse({ syncErrors: { p1: { sessions: 'duplicate key' } } })),
    );

    const { syncAllPatients, getSyncState } = await import('@/lib/db/sync');
    await syncAllPatients();

    const state = await getSyncState();
    expect(state.lastSyncedAt).toBeNull();
    expect(state.consecutiveFailures).toBe(1);
  });

  it('reports which row categories were rejected, not just the patient id', async () => {
    await db.patients.put(patient());
    await db.telemetryEvents.put({
      id: 'e1',
      sessionId: 's1',
      patientId: 'p1',
      gameType: 'object_hunt',
      difficultyLevel: 1,
      roundNumber: 1,
      isCorrect: true,
      responseTimeMs: 900,
      eventTimestamp: new Date().toISOString(),
      metadata: {},
      synced: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse({ syncErrors: { p1: { events: 'invalid game_type' } } })),
    );

    const { syncAllPatients } = await import('@/lib/db/sync');
    const result = await syncAllPatients();

    expect(result.success).toBe(false);
    expect(result.failedCategories).toEqual(['events']);
    // The rejected row stays pending rather than being marked sent.
    expect((await db.telemetryEvents.get('e1'))?.synced).toBe(false);
  });
});

describe('backoff after repeated failures', () => {
  it('skips an automatic sync inside the backoff window', async () => {
    await db.patients.put(patient());
    const failing = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', failing);

    const { syncAllPatients } = await import('@/lib/db/sync');
    await syncAllPatients();
    const second = await syncAllPatients({ respectBackoff: true });

    expect(second).toMatchObject({ success: false, error: 'backoff' });
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('still runs when the caregiver asks for it, backoff window or not', async () => {
    await db.patients.put(patient());
    const failing = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', failing);

    const { syncAllPatients } = await import('@/lib/db/sync');
    await syncAllPatients();
    await syncAllPatients();

    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('grows the wait with each failure, up to a cap', async () => {
    const { backoffMs } = await import('@/lib/db/sync');
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(99)).toBe(15 * 60_000);
  });
});
