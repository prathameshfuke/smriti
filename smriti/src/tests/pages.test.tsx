import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import type { LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';

const push = vi.fn();
const replace = vi.fn();
let pathname = '/';

const router = { push, replace };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));

const getSession = vi.fn();
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const isSupabaseConfigured = vi.fn(() => true);

const signOut = vi.fn();
const getUser = vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } } }));

/** No caregiver/patient row by default — most tests never touch `.from()`. */
let fromResult: { data: unknown; error: unknown } = { data: null, error: null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeQueryBuilder(): any {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    upsert: () => Promise.resolve(fromResult),
    maybeSingle: () => Promise.resolve(fromResult),
    then: (...args: Parameters<Promise<unknown>['then']>) => Promise.resolve(fromResult).then(...args),
  };
  return builder;
}

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
  createBrowserClient: () => ({
    auth: { getSession, signInWithOtp, verifyOtp, signOut, getUser },
    from: () => makeQueryBuilder(),
  }),
}));

import HomePage from '@/app/app/page';
import CaregiverLoginPage from '@/app/caregiver/login/page';
import CaregiverLayout from '@/app/caregiver/layout';
import CaregiverOnboardingPage from '@/app/caregiver/onboarding/page';
import CaregiverSettingsPage from '@/app/caregiver/settings/page';
import { db } from '@/lib/db/schema';

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

beforeEach(async () => {
  window.localStorage.clear();
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  push.mockClear();
  replace.mockClear();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } });
  fromResult = { data: null, error: null };
  signInWithOtp.mockReset();
  verifyOtp.mockReset();
  signOut.mockReset();
  isSupabaseConfigured.mockReturnValue(true);
  pathname = '/';
  await db.caregivers.clear();
  await db.patients.clear();
  await db.reminderSchedules.clear();
  await db.syncQueue.clear();
});

describe('Home page', () => {
  it('renders the SMRITI title', () => {
    render(<HomePage />);
    expect(screen.getByText('SMRITI')).toBeInTheDocument();
  });

  it('renders 4 game tiles when a patient is selected', () => {
    usePatientStore.getState().setCurrentPatient(patient());
    render(<HomePage />);
    expect(screen.getByRole('link', { name: /object hunt/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /word stream/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /quick tap/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /path match/i })).toBeInTheDocument();
  });

  it('renders "No patient selected" and a login button when there is no patient', () => {
    render(<HomePage />);
    expect(screen.getByText(/no patient selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /caregiver login/i })).toBeInTheDocument();
  });

  it('recovers the patient from local storage on a fresh load, instead of asking to log in again', async () => {
    // usePatientStore is in-memory only and starts empty on every reload —
    // exactly the state right after closing and reopening the app — while
    // Dexie (simulated here) still has the caregiver/patient from before.
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'Test Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    await db.patients.put(patient());

    render(<HomePage />);
    expect(screen.getByText(/no patient selected/i)).toBeInTheDocument();

    expect(await screen.findByText(/hello, aai/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /caregiver login/i })).not.toBeInTheDocument();
  });

  it('shows a cooldown message after 3 wrong PIN attempts', async () => {
    await useSettingsStore.getState().setPin('1234');
    usePatientStore.getState().setCurrentPatient(patient());
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /my progress/i }));

    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      // Let verifyPin's PBKDF2 promise chain (real Web Crypto) settle before
      // the next round of clicks.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    expect(await screen.findByText(/try again in/i)).toBeInTheDocument();
  }, 15000);
});

describe('Caregiver login page', () => {
  it('renders an email input and a submit button', () => {
    render(<CaregiverLoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send login code/i })).toBeInTheDocument();
  });

  it('shows a code input after sending', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<CaregiverLoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send login code/i }));

    expect(await screen.findByLabelText(/6-digit code/i)).toBeInTheDocument();
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'asha@example.com' }),
    );
  });

  it('verifies the typed code in-app and redirects to the dashboard, without depending on a clicked link', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    render(<CaregiverLoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send login code/i }));

    fireEvent.change(await screen.findByLabelText(/6-digit code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/caregiver/dashboard'));
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'asha@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('shows the error and lets the caregiver retry when the code is wrong', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    render(<CaregiverLoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send login code/i }));

    fireEvent.change(await screen.findByLabelText(/6-digit code/i), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

    expect(await screen.findByText(/token has expired or is invalid/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument();
  });
});

describe('Caregiver layout auth guard', () => {
  it('shows a Skeleton, then renders children once a session exists', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'Test Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    render(
      <CaregiverLayout>
        <p>Protected content</p>
      </CaregiverLayout>,
    );

    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects to onboarding when the session has no matching caregiver profile yet', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'brand-new-user' } } } });
    render(
      <CaregiverLayout>
        <p>Protected content</p>
      </CaregiverLayout>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/caregiver/onboarding'));
  });

  it('redirects to /caregiver/login when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(
      <CaregiverLayout>
        <p>Protected content</p>
      </CaregiverLayout>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/caregiver/login'));
  });

  it('renders the dashboard from the local profile alone when the Supabase session has expired', async () => {
    // The PIN already verified this caregiver before /app ever routed here —
    // a lapsed access token must not force them back through email login.
    getSession.mockResolvedValue({ data: { session: null } });
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'Test Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    render(
      <CaregiverLayout>
        <p>Protected content</p>
      </CaregiverLayout>,
    );

    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('Caregiver onboarding wizard', () => {
  it('advances the step dots on Continue', () => {
    render(<CaregiverOnboardingPage />);
    expect(screen.getByLabelText('Step 1 of 3')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Your name'), {
      target: { value: 'Ranjita' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ASHA Worker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByLabelText('Step 2 of 3')).toBeInTheDocument();
  });

  it('treats role, gender and duration as exclusive-select groups', () => {
    render(<CaregiverOnboardingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'ASHA Worker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Doctor' }));
    expect(screen.getByRole('button', { name: 'Doctor' }).className).toContain('bg-primary');
    expect(screen.getByRole('button', { name: 'ASHA Worker' }).className).not.toContain(
      'bg-primary',
    );
  });

  it('blocks Finish when the PIN and its confirmation do not match', async () => {
    render(<CaregiverOnboardingPage />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), {
      target: { value: 'Ranjita' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ASHA Worker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(screen.getByPlaceholderText('Patient name'), {
      target: { value: 'Aai' },
    });
    fireEvent.change(screen.getByPlaceholderText('Age'), { target: { value: '72' } });
    fireEvent.click(screen.getByRole('button', { name: 'Female' }));
    fireEvent.click(screen.getByRole('button', { name: '10 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const pinPads = screen.getAllByRole('group', { name: 'PIN keypad' });
    fireEvent.click(within(pinPads[0]).getByRole('button', { name: '1' }));
    fireEvent.click(within(pinPads[0]).getByRole('button', { name: '2' }));
    fireEvent.click(within(pinPads[0]).getByRole('button', { name: '3' }));
    fireEvent.click(within(pinPads[0]).getByRole('button', { name: '4' }));
    fireEvent.click(within(pinPads[1]).getByRole('button', { name: '9' }));
    fireEvent.click(within(pinPads[1]).getByRole('button', { name: '9' }));
    fireEvent.click(within(pinPads[1]).getByRole('button', { name: '9' }));
    fireEvent.click(within(pinPads[1]).getByRole('button', { name: '9' }));

    fireEvent.click(screen.getByRole('button', { name: 'Finish Setup' }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('on the happy path writes the caregiver, patient and PIN, then navigates home', async () => {
    render(<CaregiverOnboardingPage />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), {
      target: { value: 'Ranjita' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ASHA Worker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(screen.getByPlaceholderText('Patient name'), {
      target: { value: 'Aai' },
    });
    fireEvent.change(screen.getByPlaceholderText('Age'), { target: { value: '72' } });
    fireEvent.click(screen.getByRole('button', { name: 'Female' }));
    fireEvent.click(screen.getByRole('button', { name: '10 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const pinPads = screen.getAllByRole('group', { name: 'PIN keypad' });
    for (const pad of pinPads) {
      for (const digit of ['1', '2', '3', '4']) {
        fireEvent.click(within(pad).getByRole('button', { name: digit }));
      }
    }

    fireEvent.click(screen.getByRole('button', { name: 'Add morning medication reminder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish Setup' }));

    // Wait for device trust step 4 to appear
    await waitFor(() => expect(screen.getByText(/trust this device/i)).toBeInTheDocument());

    // Click Done on device trust screen
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/app'));

    expect(await db.caregivers.count()).toBe(1);
    expect(await db.patients.count()).toBe(1);
    expect(await db.reminderSchedules.count()).toBe(1);
    expect(useSettingsStore.getState().caregiverPinHash).toBeTruthy();
  });
});

describe('Caregiver settings page', () => {
  it('blocks the new-PIN step when the current PIN is wrong', async () => {
    await useSettingsStore.getState().setPin('1234');
    render(<CaregiverSettingsPage />);

    for (const digit of ['9', '9', '9', '9']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }

    expect(await screen.findByText(/current pin is incorrect/i)).toBeInTheDocument();
    expect(screen.getByText('Enter current PIN')).toBeInTheDocument();
  });

  it('saves a new PIN once the current PIN verifies and the new one is confirmed', async () => {
    await useSettingsStore.getState().setPin('1234');
    const originalHash = useSettingsStore.getState().caregiverPinHash;
    render(<CaregiverSettingsPage />);

    for (const digit of ['1', '2', '3', '4']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }
    await screen.findByText('Enter new PIN');

    for (const digit of ['5', '6', '7', '8']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }
    await screen.findByText('Confirm new PIN');

    for (const digit of ['5', '6', '7', '8']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }

    expect(await screen.findByText(/pin updated/i)).toBeInTheDocument();
    expect(useSettingsStore.getState().caregiverPinHash).not.toBe(originalHash);
  });

  it('logs out and navigates to the login page', async () => {
    signOut.mockResolvedValue({ error: null });
    render(<CaregiverSettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/caregiver/login'));
    expect(signOut).toHaveBeenCalled();
  });

  it('clears the local caregiver/patient profile on logout, so a PIN alone cannot get back in', async () => {
    signOut.mockResolvedValue({ error: null });
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'Test Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    await db.patients.put(patient());
    usePatientStore.setState({ currentPatient: patient() });

    render(<CaregiverSettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/caregiver/login'));
    expect(await db.caregivers.count()).toBe(0);
    expect(usePatientStore.getState().currentPatient).toBeNull();
  });

  it('wipes local data and PIN when Delete All Data is confirmed with the correct PIN', async () => {
    signOut.mockResolvedValue({ error: null });
    await useSettingsStore.getState().setPin('1234');
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'Test Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    await db.patients.put(patient());

    render(<CaregiverSettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: /delete all data/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, delete everything/i }));

    for (const digit of ['1', '2', '3', '4']) {
      fireEvent.click(await screen.findByRole('button', { name: digit }));
    }

    await waitFor(() => expect(push).toHaveBeenCalledWith('/caregiver/login'));
    expect(await db.caregivers.count()).toBe(0);
    expect(await db.patients.count()).toBe(0);
    expect(useSettingsStore.getState().caregiverPinHash).toBeNull();
  });

  it('rejects Delete All Data with the wrong PIN and keeps local data intact', async () => {
    await useSettingsStore.getState().setPin('1234');
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'Test Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });

    render(<CaregiverSettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: /delete all data/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, delete everything/i }));

    for (const digit of ['9', '9', '9', '9']) {
      fireEvent.click(await screen.findByRole('button', { name: digit }));
    }

    expect(await screen.findByText(/pin is incorrect/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith('/caregiver/login');
    expect(await db.caregivers.count()).toBe(1);
  });
});
