import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db, type LocalPatient } from '@/lib/db/schema';
import { restoreLocalSession } from '@/lib/auth/localSession';
import { usePatientStore } from '@/stores/patientStore';
import { useCaregiverStore } from '@/stores/caregiverStore';

/**
 * Unlike src/tests/pages.test.tsx (which globally mocks
 * `@/lib/auth/deviceTrust` so it can deterministically hand back whatever
 * token a given test wants), these tests exercise the REAL client
 * implementation against a REAL Dexie-backed `smriti` IndexedDB database
 * (via fake-indexeddb). That real implementation is exactly what a mocked
 * module can never catch a regression in.
 */

const getSession = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({
    auth: { getSession },
  }),
}));

const patient = (over: Partial<LocalPatient> = {}): LocalPatient => ({
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
  updatedAt: '2026-08-31T00:00:00.000Z',
  syncedAt: null,
  ...over,
});

function mockOnlineTrustFetch(patientId: string) {
  getSession.mockResolvedValue({
    data: { session: { user: { id: 'u1' }, access_token: 'test-access-token' } },
  });
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        token: { patientId, issuedAt: Date.now(), issuedBy: 'c1', signature: 'server-issued-sig' },
      }),
  });
}

describe('device trust persistence (real Dexie + real deviceTrust.ts, not mocked)', () => {
  beforeEach(async () => {
    usePatientStore.setState(usePatientStore.getInitialState(), true);
    useCaregiverStore.setState(useCaregiverStore.getInitialState(), true);
    await db.caregivers.clear();
    await db.patients.clear();
    await db.deviceTrust.clear();
    getSession.mockReset();
    vi.unstubAllGlobals();
  });

  it('setDeviceTrustToken succeeds even though Dexie already opened "smriti" first — the order every real onboarding runs in', async () => {
    const { setDeviceTrustToken, getDeviceTrustToken } = await import('@/lib/auth/deviceTrust');

    // Onboarding's `setupDatabase()` always writes the caregiver/patient via
    // Dexie *before* the "Trust this device" step ever runs (see
    // caregiver/onboarding/page.tsx's `finish()`), so by the time device
    // trust is ever touched, Dexie has already opened "smriti" for real.
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'ASHA Worker',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    await db.patients.put(patient());

    vi.stubGlobal('fetch', mockOnlineTrustFetch('p1'));

    await expect(setDeviceTrustToken('p1')).resolves.toBeUndefined();

    const stored = await getDeviceTrustToken();
    expect(stored).toMatchObject({ patientId: 'p1' });
  });

  it('an offline reopen restores the device-trust token\'s patient (not just the first active one) via real storage, with no network call succeeding', async () => {
    const { setDeviceTrustToken } = await import('@/lib/auth/deviceTrust');

    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'ASHA Worker',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    // A kiosk device carrying two patients locally (e.g. an ASHA worker) —
    // trust is established for the *second* one, the case the "first active
    // patient" fallback alone gets wrong.
    await db.patients.put(patient({ id: 'p1', displayName: 'Aai' }));
    await db.patients.put(patient({ id: 'p2', displayName: 'Baba' }));

    vi.stubGlobal('fetch', mockOnlineTrustFetch('p2'));
    await setDeviceTrustToken('p2');

    // Simulate the device being closed and reopened fully offline: the
    // in-memory stores reset (exactly like a fresh page load), and every
    // network path is wired to fail loudly if it's ever actually called.
    // `getSession` is cleared here (not just re-mocked) so the assertion
    // below only counts calls made *during* the offline restore itself, not
    // the one real call above that established trust in the first place.
    usePatientStore.setState(usePatientStore.getInitialState(), true);
    useCaregiverStore.setState(useCaregiverStore.getInitialState(), true);
    getSession.mockReset();
    getSession.mockRejectedValue(new Error('should never be called while offline'));
    const fetchSpy = vi.fn().mockRejectedValue(new Error('NetworkError: offline'));
    vi.stubGlobal('fetch', fetchSpy);
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });

    const restored = await restoreLocalSession();

    expect(restored).toBe(true);
    expect(usePatientStore.getState().currentPatient?.id).toBe('p2');
    expect(usePatientStore.getState().currentPatient?.displayName).toBe('Baba');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });
});
