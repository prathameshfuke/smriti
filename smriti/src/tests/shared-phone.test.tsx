import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { db, type LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useCaregiverStore } from '@/stores/caregiverStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { I18nProvider } from '@/lib/i18n/provider';

/**
 * Several patients on one phone, and adding a patient who plays on their own
 * phone. Real Dexie (fake-indexeddb) and the real deviceTrust / localSession
 * modules; only the network edge is stubbed.
 */

const push = vi.fn();
const replace = vi.fn();
let pathname = '/app';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const getSession = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession } }),
}));

const pushCaregiverProfile = vi.fn();
const pullCaregiverProfile = vi.fn();
vi.mock('@/lib/db/serverProfile', () => ({
  pushCaregiverProfile: (...args: unknown[]) => pushCaregiverProfile(...args),
  pullCaregiverProfile: (...args: unknown[]) => pullCaregiverProfile(...args),
}));

const patient = (over: Partial<LocalPatient> = {}): LocalPatient => ({
  id: 'p1',
  caregiverId: 'c1',
  displayName: 'Maya',
  ageYears: 74,
  gender: 'female',
  educationYears: 4,
  primaryLanguage: 'en',
  sessionDurationMinutes: 10,
  isActive: true,
  currentDifficulty: {},
  updatedAt: '2026-09-01T00:00:00.000Z',
  syncedAt: null,
  ...over,
});

/** /api/device-trust issues a token for whichever patient was asked for. */
function trustFetch() {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/device-trust') {
      const { patientId } = JSON.parse(String(init?.body));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ token: { patientId, issuedAt: Date.now(), issuedBy: 'u1', signature: 'sig' } }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

beforeEach(async () => {
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useCaregiverStore.setState(useCaregiverStore.getInitialState(), true);
  useSettingsStore.setState({ activePatientId: null, lastActivityAt: null, language: 'en' });
  await Promise.all([db.caregivers.clear(), db.patients.clear(), db.deviceTrust.clear(), db.reminderSchedules.clear()]);
  await db.caregivers.put({ id: 'c1', authUserId: 'u1', displayName: 'Asha', role: 'family', createdAt: '2026-09-01T00:00:00.000Z' });
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'tok' } } });
  push.mockClear();
  replace.mockClear();
  pushCaregiverProfile.mockReset();
  pullCaregiverProfile.mockReset();
  pullCaregiverProfile.mockResolvedValue({ status: 'error' });
  useSettingsStore.setState({ caregiverPinHash: null });
  pathname = '/app';
  vi.stubGlobal('fetch', trustFetch());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('device trust for several patients', () => {
  it('keeps one token per patient and removes only the one asked for', async () => {
    const { setDeviceTrustToken, getTrustedPatientIds, getDeviceTrustToken, removeDeviceTrust } = await import(
      '@/lib/auth/deviceTrust'
    );
    await setDeviceTrustToken('p1');
    await setDeviceTrustToken('p2');
    expect((await getTrustedPatientIds()).sort()).toEqual(['p1', 'p2']);
    expect(await getDeviceTrustToken('p2')).toMatchObject({ patientId: 'p2' });

    await removeDeviceTrust('p1');
    expect(await getTrustedPatientIds()).toEqual(['p2']);
    expect(await getDeviceTrustToken('p1')).toBeNull();
  });

  it("still reads a phone's original single token", async () => {
    await db.deviceTrust.put({ patientId: 'p1', issuedAt: Date.now(), issuedBy: 'u1', signature: 'old' }, 'deviceTrustToken');
    const { getDeviceTrustToken, getTrustedPatientIds } = await import('@/lib/auth/deviceTrust');
    expect(await getTrustedPatientIds()).toEqual(['p1']);
    expect(await getDeviceTrustToken('p1')).toMatchObject({ signature: 'old' });
  });
});

describe('getDevicePatients', () => {
  it('treats a lone local patient as the phone’s patient even without a token', async () => {
    await db.patients.put(patient());
    const { getDevicePatients, needsDevicePatientChoice } = await import('@/lib/auth/localSession');
    expect((await getDevicePatients()).map((p) => p.id)).toEqual(['p1']);
    expect(await needsDevicePatientChoice()).toBe(false);
  });

  it('assumes nobody when an account with several patients signs in on an unlinked phone', async () => {
    await db.patients.bulkPut([patient(), patient({ id: 'p2', displayName: 'Hari' })]);
    const { getDevicePatients, needsDevicePatientChoice } = await import('@/lib/auth/localSession');
    expect(await getDevicePatients()).toEqual([]);
    expect(await needsDevicePatientChoice()).toBe(true);
  });

  it('returns only the linked patients once the caregiver chooses', async () => {
    await db.patients.bulkPut([patient(), patient({ id: 'p2', displayName: 'Hari' }), patient({ id: 'p3', displayName: 'Lakshmi' })]);
    const { setDeviceTrustToken } = await import('@/lib/auth/deviceTrust');
    await setDeviceTrustToken('p1');
    await setDeviceTrustToken('p2');
    const { getDevicePatients } = await import('@/lib/auth/localSession');
    expect((await getDevicePatients()).map((p) => p.displayName)).toEqual(['Hari', 'Maya']);
  });

  it('restores whoever was last chosen on a shared phone', async () => {
    await db.patients.bulkPut([patient(), patient({ id: 'p2', displayName: 'Hari' })]);
    const { setDeviceTrustToken } = await import('@/lib/auth/deviceTrust');
    await setDeviceTrustToken('p1');
    await setDeviceTrustToken('p2');
    useSettingsStore.setState({ activePatientId: 'p2' });
    const { restoreLocalSession } = await import('@/lib/auth/localSession');
    await restoreLocalSession();
    expect(usePatientStore.getState().currentPatient?.id).toBe('p2');
  });
});

describe('patient home on a shared phone', () => {
  async function sharedPhone() {
    await db.patients.bulkPut([patient(), patient({ id: 'p2', displayName: 'Hari', primaryLanguage: 'hi' })]);
    const { setDeviceTrustToken } = await import('@/lib/auth/deviceTrust');
    await setDeviceTrustToken('p1');
    await setDeviceTrustToken('p2');
  }

  it('asks who is playing, then shows that person’s home and switches to their language', async () => {
    await sharedPhone();
    const { default: HomePage } = await import('@/app/app/page');
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );

    expect(await screen.findByRole('heading', { name: /who is playing/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /choose a game/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hari/i }));

    await waitFor(() => expect(usePatientStore.getState().currentPatient?.id).toBe('p2'));
    expect(useSettingsStore.getState().activePatientId).toBe('p2');
    expect(useSettingsStore.getState().language).toBe('hi');
    // Hari's language is Hindi, so the switch button is in Hindi now.
    expect(await screen.findByRole('button', { name: 'आप Hari नहीं हैं?' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /who is playing|कौन खेल रहा है/i })).not.toBeInTheDocument();
  });

  it('"Not you?" brings the picker back', async () => {
    await sharedPhone();
    useSettingsStore.setState({ activePatientId: 'p1', lastActivityAt: Date.now() });
    const { default: HomePage } = await import('@/app/app/page');
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /not maya/i }));
    expect(await screen.findByRole('heading', { name: /who is playing/i })).toBeInTheDocument();
  });

  it('asks again after the phone has been left for over 30 minutes', async () => {
    await sharedPhone();
    useSettingsStore.setState({ activePatientId: 'p1', lastActivityAt: Date.now() - 31 * 60_000 });
    const { default: HomePage } = await import('@/app/app/page');
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(await screen.findByRole('heading', { name: /who is playing/i })).toBeInTheDocument();
  });

  it('tells the patient a caregiver must choose when nobody is linked yet', async () => {
    await db.patients.bulkPut([patient(), patient({ id: 'p2', displayName: 'Hari' })]);
    const { default: HomePage } = await import('@/app/app/page');
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(await screen.findByRole('heading', { name: /choose who uses this phone/i })).toBeInTheDocument();
  });
});

describe('Add patient', () => {
  it('own phone: saves to the account only and leaves this phone unchanged', async () => {
    await db.patients.put(patient());
    pushCaregiverProfile.mockResolvedValue(true);
    pathname = '/caregiver/add-patient';
    const { default: AddPatientPage } = await import('@/app/caregiver/add-patient/page');
    render(<AddPatientPage />);

    fireEvent.click(screen.getByRole('button', { name: /on their own phone or tablet/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Hari' } });
    fireEvent.change(screen.getByLabelText(/^age$/i), { target: { value: '81' } });
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    fireEvent.click(screen.getByRole('button', { name: /add hari/i }));

    expect(await screen.findByRole('heading', { name: /hari is added/i })).toBeInTheDocument();
    expect(pushCaregiverProfile).toHaveBeenCalledTimes(1);
    expect(pushCaregiverProfile.mock.calls[0][1]).toMatchObject({ displayName: 'Hari', ageYears: 81 });
    expect(await db.patients.count()).toBe(1);
  });

  it('own phone: says so and stays on the form when the account can’t be reached', async () => {
    pushCaregiverProfile.mockResolvedValue(false);
    const { default: AddPatientPage } = await import('@/app/caregiver/add-patient/page');
    render(<AddPatientPage />);

    fireEvent.click(screen.getByRole('button', { name: /on their own phone or tablet/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Hari' } });
    fireEvent.change(screen.getByLabelText(/^age$/i), { target: { value: '81' } });
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    fireEvent.click(screen.getByRole('button', { name: /add hari/i }));

    expect(await screen.findByText(/could not save to your account/i)).toBeInTheDocument();
  });

  it('shared phone: adds them here and links the phone to both people', async () => {
    await db.patients.put(patient());
    pushCaregiverProfile.mockResolvedValue(true);
    const { default: AddPatientPage } = await import('@/app/caregiver/add-patient/page');
    render(<AddPatientPage />);

    fireEvent.click(screen.getByRole('button', { name: /on this phone, shared/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Hari' } });
    fireEvent.change(screen.getByLabelText(/^age$/i), { target: { value: '81' } });
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    fireEvent.click(screen.getByRole('button', { name: /add hari/i }));

    expect(await screen.findByRole('heading', { name: /hari is added/i })).toBeInTheDocument();
    const { getDevicePatients } = await import('@/lib/auth/localSession');
    expect((await getDevicePatients()).map((p) => p.displayName)).toEqual(['Hari', 'Maya']);
  });

  it('keeps Add disabled until name, age in range and gender are filled', async () => {
    const { default: AddPatientPage } = await import('@/app/caregiver/add-patient/page');
    render(<AddPatientPage />);
    fireEvent.click(screen.getByRole('button', { name: /on this phone, shared/i }));
    const add = () => screen.getByRole('button', { name: /^add /i });
    expect(add()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Hari' } });
    fireEvent.change(screen.getByLabelText(/^age$/i), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    expect(add()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^age$/i), { target: { value: '70' } });
    expect(add()).not.toBeDisabled();
  });
});

describe('signing in on a patient’s own phone', () => {
  const caregiver = { id: 'c1', authUserId: 'u1', displayName: 'Asha', role: 'family' as const, createdAt: '2026-09-01T00:00:00.000Z' };

  it('selects nobody when the account has several patients and this phone is not linked yet', async () => {
    await db.caregivers.clear();
    pullCaregiverProfile.mockResolvedValue({
      status: 'found',
      caregiver,
      patients: [patient(), patient({ id: 'p2', displayName: 'Hari' })],
      reminders: [],
    });
    const { pullAndStoreServerProfile, needsDevicePatientChoice } = await import('@/lib/auth/localSession');
    await pullAndStoreServerProfile('u1');
    expect(usePatientStore.getState().currentPatient).toBeNull();
    expect(await needsDevicePatientChoice()).toBe(true);
  });

  it('selects the linked patient, not the first on the account', async () => {
    const { setDeviceTrustToken } = await import('@/lib/auth/deviceTrust');
    await setDeviceTrustToken('p2');
    await db.caregivers.clear();
    pullCaregiverProfile.mockResolvedValue({
      status: 'found',
      caregiver,
      patients: [patient(), patient({ id: 'p2', displayName: 'Hari' })],
      reminders: [],
    });
    const { pullAndStoreServerProfile } = await import('@/lib/auth/localSession');
    await pullAndStoreServerProfile('u1');
    expect(usePatientStore.getState().currentPatient?.id).toBe('p2');
  });

  it('home corrects a wrong selected patient to the phone’s own patient', async () => {
    await db.patients.bulkPut([patient(), patient({ id: 'p2', displayName: 'Hari', primaryLanguage: 'hi' })]);
    const { setDeviceTrustToken } = await import('@/lib/auth/deviceTrust');
    await setDeviceTrustToken('p2');
    usePatientStore.getState().setCurrentPatient(patient());
    const { default: HomePage } = await import('@/app/app/page');
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    await waitFor(() => expect(usePatientStore.getState().currentPatient?.id).toBe('p2'));
    expect(await screen.findByRole('heading', { name: /hari/i })).toBeInTheDocument();
  });

  it('sends "Caregiver" to email sign-in when no PIN exists, since a PIN dialog could never succeed', async () => {
    await db.patients.bulkPut([patient(), patient({ id: 'p2', displayName: 'Hari' })]);
    const { default: HomePage } = await import('@/app/app/page');
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Caregiver' }));
    expect(push).toHaveBeenCalledWith(`/caregiver/login?next=${encodeURIComponent('/caregiver/device?setup=1')}`);
    expect(screen.queryByRole('dialog', { name: /enter caregiver pin/i })).not.toBeInTheDocument();
  });
});

describe('Add patient, shared phone, offline', () => {
  it('does not create a phone-only patient that could never sync', async () => {
    await db.patients.put(patient());
    pushCaregiverProfile.mockResolvedValue(false);
    const { default: AddPatientPage } = await import('@/app/caregiver/add-patient/page');
    render(<AddPatientPage />);

    fireEvent.click(screen.getByRole('button', { name: /on this phone, shared/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Hari' } });
    fireEvent.change(screen.getByLabelText(/^age$/i), { target: { value: '81' } });
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    fireEvent.click(screen.getByRole('button', { name: /add hari/i }));

    expect(await screen.findByText(/could not save to your account/i)).toBeInTheDocument();
    expect(await db.patients.count()).toBe(1);
  });
});

describe('phone links never cross patients', () => {
  it('does not hand out another patient’s token for the patient who is playing', async () => {
    const { setDeviceTrustToken, getDeviceTrustToken } = await import('@/lib/auth/deviceTrust');
    await setDeviceTrustToken('p1');
    usePatientStore.getState().setCurrentPatient(patient({ id: 'p2', displayName: 'Hari' }));
    expect(await getDeviceTrustToken()).toBeNull();
  });

  it('ignores links left by a previous caregiver on the phone', async () => {
    const { setDeviceTrustToken } = await import('@/lib/auth/deviceTrust');
    await setDeviceTrustToken('other-family-patient');
    await db.patients.bulkPut([patient(), patient({ id: 'p2', displayName: 'Hari' })]);
    const { getDevicePatients, needsDevicePatientChoice, restoreLocalSession } = await import('@/lib/auth/localSession');
    expect(await getDevicePatients()).toEqual([]);
    expect(await needsDevicePatientChoice()).toBe(true);
    await restoreLocalSession();
    expect(usePatientStore.getState().currentPatient).toBeNull();
  });
});

