import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { I18nProvider } from '@/lib/i18n/provider';

// HomePage (My Progress button) and CaregiverSettingsPage (disclaimer) both
// call useTranslation() unconditionally now — every render in this file
// needs the provider in the tree, not just the ones exercising those strings.
function render(ui: Parameters<typeof rtlRender>[0], options?: Parameters<typeof rtlRender>[1]) {
  return rtlRender(ui, { wrapper: I18nProvider, ...options });
}

const push = vi.fn();
const replace = vi.fn();
let pathname = '/';
let searchParams = new URLSearchParams();

const router = { push, replace };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

const getSession = vi.fn();
const signInWithOtp = vi.fn();
const signInWithOAuth = vi.fn();
const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();
const isSupabaseConfigured = vi.fn(() => true);

const signOut = vi.fn();
const getUser = vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } } }));

/** No caregiver row by default — most tests never touch `.from()`. */
let fromResult: { data: unknown; error: unknown } = { data: null, error: null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeQueryBuilder(table: string): any {
  // Only `caregivers` reads the test-configurable `fromResult` (a single row
  // via .maybeSingle()) — patients/reminder_schedules default to an empty
  // array, matching pullCaregiverProfile's real shape for each table. A
  // shared single value for every table broke as soon as a caregiver lookup
  // needed to differ from the patients lookup that follows it in the same
  // call (e.g. a "found" caregiver with zero patients).
  const result = table === 'caregivers' ? fromResult : { data: [], error: null };
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    upsert: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (...args: Parameters<Promise<unknown>['then']>) => Promise.resolve(result).then(...args),
  };
  return builder;
}

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
  createBrowserClient: () => ({
    auth: { getSession, signInWithOtp, signInWithOAuth, verifyOtp, exchangeCodeForSession, signOut, getUser },
    from: (table: string) => makeQueryBuilder(table),
  }),
  createLoginLinkClient: () => ({
    auth: { signInWithOtp },
  }),
}));

const { syncAllPatients } = vi.hoisted(() => ({
  syncAllPatients: vi.fn(() => Promise.resolve({ success: true })),
}));
vi.mock('@/lib/db/sync', () => ({ syncAllPatients }));

/** null by default — most tests never touch the device-trust token. */
let deviceTrustToken: unknown = null;
vi.mock('@/lib/auth/deviceTrust', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('@/lib/auth/deviceTrust');
  return {
    ...actual,
    getDeviceTrustToken: () => Promise.resolve(deviceTrustToken),
    // Kept consistent with the token above: the real module derives both
    // from the same rows.
    getTrustedPatientIds: () =>
      Promise.resolve(deviceTrustToken ? [(deviceTrustToken as { patientId: string }).patientId] : []),
  };
});

import HomePage from '@/app/app/page';
import CaregiverLoginPage from '@/app/caregiver/login/page';
import CaregiverLoginCallbackPage from '@/app/caregiver/login/callback/page';
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
  syncAllPatients.mockClear();
  fromResult = { data: null, error: null };
  signInWithOtp.mockReset();
  signInWithOAuth.mockReset();
  verifyOtp.mockReset();
  exchangeCodeForSession.mockReset();
  signOut.mockReset();
  isSupabaseConfigured.mockReturnValue(true);
  deviceTrustToken = null;
  pathname = '/';
  searchParams = new URLSearchParams();
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
    expect(screen.getByRole('link', { name: /market list/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /quick tap/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /path match/i })).toBeInTheDocument();
  });

  it('shows its buttons, headings and game names in the chosen language', () => {
    useSettingsStore.setState({ language: 'hi' });
    usePatientStore.getState().setCurrentPatient(patient());
    render(<HomePage />);
    expect(screen.getByRole('button', { name: 'स्मृति से पूछें' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'मेरे रिमाइंडर' })).toBeInTheDocument();
    expect(screen.getByText('एक खेल चुनें')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /बाज़ार सूची/ })).toBeInTheDocument();
    expect(screen.queryByText('Choose a game')).not.toBeInTheDocument();
    useSettingsStore.setState({ language: 'en' });
  });

  it('renders "Nobody is set up on this phone" and a sign-in button when there is no patient', async () => {
    // No local caregiver/patient in Dexie, so the cold-start restore this
    // page runs resolves to "nothing to restore" — but only after an async
    // Dexie read. Until then the page shows a loading state, not this
    // fallback, so a legitimate returning patient never sees a false
    // "Nobody is set up on this phone" flash while restoration is still in flight.
    render(<HomePage />);
    expect(await screen.findByText(/nobody is set up on this phone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /caregiver sign in/i })).toBeInTheDocument();
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

    // While restoration is in flight, neither the final "Hello" text nor the
    // "Nobody is set up on this phone" / sign-in fallback should be visible.
    expect(screen.queryByText(/no patient selected/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /caregiver sign in/i })).not.toBeInTheDocument();

    expect(await screen.findByText(/hello, aai/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /caregiver sign in/i })).not.toBeInTheDocument();
  });

  it('restores the device-trust token\'s patient, not just any active patient of the caregiver', async () => {
    // A kiosk device is trusted for exactly one patient (its device-trust
    // token), but an ASHA worker's caregiver profile can carry more than one
    // locally. Restoration must key off the token, not "whichever active
    // patient happens to be first" — otherwise a shared device could wake up
    // pointed at the wrong patient's games and reminders.
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'Test Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    await db.patients.put(patient({ id: 'p1', displayName: 'Aai' }));
    await db.patients.put(patient({ id: 'p2', displayName: 'Baba' }));
    deviceTrustToken = {
      patientId: 'p2',
      issuedAt: Date.now(),
      issuedBy: 'c1',
      signature: 'server-issued-signature-opaque-to-the-client',
    };

    render(<HomePage />);

    expect(await screen.findByText(/hello, baba/i)).toBeInTheDocument();
  });

  it('REPRO: reaches the patient home screen fully offline when this device already completed onboarding', async () => {
    // Simulates the exact caregiver-reported bug: a device that has already
    // finished onboarding (a local caregiver+patient row and a device-trust
    // token already sit in Dexie/IndexedDB from a prior online session) is
    // then opened with zero connectivity. Reaching the patient's home screen
    // must never depend on a live network call succeeding.
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'Test Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    await db.patients.put(patient());
    deviceTrustToken = {
      patientId: 'p1',
      issuedAt: Date.now(),
      issuedBy: 'c1',
      signature: 'server-issued-signature-opaque-to-the-client',
    };

    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    getSession.mockRejectedValue(new Error('should never be called while offline'));
    const fetchSpy = vi.fn().mockRejectedValue(new Error('NetworkError: offline'));
    vi.stubGlobal('fetch', fetchSpy);

    render(<HomePage />);

    expect(await screen.findByText(/hello, aai/i)).toBeInTheDocument();
    expect(screen.queryByText(/no patient selected/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /caregiver sign in/i })).not.toBeInTheDocument();
    expect(getSession).not.toHaveBeenCalled();

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    vi.unstubAllGlobals();
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
      // Wait for THIS round's real verifyPin (PBKDF2, real Web Crypto) to
      // actually settle before the next round of clicks — not a fixed
      // delay. A fixed setTimeout(50) here previously assumed 50ms was
      // always enough; under full-suite CPU contention it sometimes
      // wasn't, and the app's own `verifying` guard (app/app/page.tsx —
      // correctly, this is what stops a real attacker from out-typing the
      // lockout) then silently drops the next round's clicks because they
      // land while still mid-verification, undercounting real wrong
      // attempts in the test the same way the bug once did for a
      // different reason. Waiting for the keypad to re-enable (or the
      // cooldown message to appear, on the final round once the 3rd
      // attempt triggers it) tracks the actual async completion instead
      // of guessing a duration.
      await waitFor(() => {
        const nineButton = screen.getByRole('button', { name: '9' });
        const cooldownVisible = screen.queryByText(/try again in/i) !== null;
        expect(!nineButton.hasAttribute('disabled') || cooldownVisible).toBe(true);
      });
    }

    expect(await screen.findByText(/try again in/i)).toBeInTheDocument();
  }, 15000);

  it('keeps a wrong-PIN lockout active across a reload, not just for as long as the dialog stays mounted', async () => {
    // Regression coverage for the actual bug: attempts/cooldown used to be
    // component useState, which reset on any remount — a reload (or just
    // closing and reopening the PWA) fully cleared the 3-strikes lockout,
    // no matter how many wrong attempts came before it. Setting the store
    // directly here stands in for a real reload: zustand's persist
    // middleware would already have written this to localStorage before
    // the reload happened, so a fresh mount reads it back exactly like this.
    await useSettingsStore.getState().setPin('1234');
    usePatientStore.getState().setCurrentPatient(patient());
    useSettingsStore.setState({ pinAttempts: 3, pinCooldownUntil: Date.now() + 30_000 });

    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: /my progress/i }));

    expect(await screen.findByText(/try again in/i)).toBeInTheDocument();
  });

  it('never shows a PIN prompt or any credential input until the caregiver icon is tapped', () => {
    usePatientStore.getState().setCurrentPatient(patient());
    render(<HomePage />);
    expect(screen.queryByRole('dialog', { name: /enter caregiver pin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'PIN keypad' })).not.toBeInTheDocument();
  });

  it('lets a correct PIN straight into the dashboard while the caregiver session is still fresh, with no Supabase check', async () => {
    // The PIN is the whole point of not re-authenticating on every switch —
    // a live check on every unlock would defeat that (and break offline use).
    await useSettingsStore.getState().setPin('1234');
    useSettingsStore.getState().markCaregiverSessionVerified();
    usePatientStore.getState().setCurrentPatient(patient());
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /my progress/i }));
    for (const digit of ['1', '2', '3', '4']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }

    await waitFor(() => expect(push).toHaveBeenCalledWith('/caregiver/dashboard'));
    expect(getSession).not.toHaveBeenCalled();
  });

  it('switching to patient view does not clear the caregiver PIN or session — only Log Out or Delete All Data do', async () => {
    // Navigating /app <-> /caregiver/* is plain client-side routing; nothing
    // on the patient screen touches settingsStore or the local caregiver
    // profile. Rendering the patient home page is enough to prove this: if
    // mounting it cleared anything, these would already be gone.
    await useSettingsStore.getState().setPin('1234');
    useSettingsStore.getState().markCaregiverSessionVerified();
    usePatientStore.getState().setCurrentPatient(patient());
    render(<HomePage />);

    expect(useSettingsStore.getState().caregiverPinHash).not.toBeNull();
    expect(useSettingsStore.getState().caregiverSessionVerifiedAt).not.toBeNull();
  });

  it('falls back to full email login when the PIN is correct but the underlying session has actually expired', async () => {
    await useSettingsStore.getState().setPin('1234');
    // Older than the 24h freshness window: a correct PIN alone is no longer
    // enough, and the live check below reports the session is really gone.
    useSettingsStore.setState({ caregiverSessionVerifiedAt: Date.now() - 25 * 60 * 60 * 1000 });
    getSession.mockResolvedValue({ data: { session: null } });
    usePatientStore.getState().setCurrentPatient(patient());
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /my progress/i }));
    for (const digit of ['1', '2', '3', '4']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }

    await waitFor(() => expect(push).toHaveBeenCalledWith('/caregiver/login?next=/app'));
    expect(push).not.toHaveBeenCalledWith('/caregiver/dashboard');
  });

  it('a stale but still-live session refreshes the freshness timestamp and proceeds on a correct PIN', async () => {
    await useSettingsStore.getState().setPin('1234');
    useSettingsStore.setState({ caregiverSessionVerifiedAt: Date.now() - 25 * 60 * 60 * 1000 });
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    usePatientStore.getState().setCurrentPatient(patient());
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /my progress/i }));
    for (const digit of ['1', '2', '3', '4']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }

    await waitFor(() => expect(push).toHaveBeenCalledWith('/caregiver/dashboard'));
    expect(useSettingsStore.getState().caregiverSessionVerifiedAt).toBeGreaterThan(
      Date.now() - 5000,
    );
  });

  it('lets a correct PIN through while offline even with a stale session, deferring verification', async () => {
    await useSettingsStore.getState().setPin('1234');
    const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000;
    useSettingsStore.setState({ caregiverSessionVerifiedAt: staleTimestamp });
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    usePatientStore.getState().setCurrentPatient(patient());
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /my progress/i }));
    for (const digit of ['1', '2', '3', '4']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }

    await waitFor(() => expect(push).toHaveBeenCalledWith('/caregiver/dashboard'));
    // Not marked freshly verified — offline could not actually confirm it,
    // so the next unlock attempt re-checks instead of trusting this one.
    expect(useSettingsStore.getState().caregiverSessionVerifiedAt).toBe(staleTimestamp);
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });
});

describe('Caregiver login page', () => {
  it('renders an email input and a submit button', () => {
    render(<CaregiverLoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send login code/i })).toBeInTheDocument();
  });

  it('shows a code input after sending, no redirect involved at all', async () => {
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
    // No redirectTo/emailRedirectTo at all — a code has nothing to redirect to.
    expect(signInWithOtp.mock.calls[0][0]).not.toHaveProperty('options');
  });

  it('verifies the typed code in-app and redirects to the dashboard — no callback page, no cookie hop', async () => {
    // A PIN already on this device means this is a returning caregiver, not
    // a first-ever login — goes straight to `next`, skipping the one-time
    // "set up quick access" PIN step covered separately below.
    useSettingsStore.setState({ caregiverPinHash: 'existing-hash' });
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null });
    fromResult = {
      data: {
        id: 'c1',
        auth_id: 'test-user',
        display_name: 'ASHA Worker',
        role: 'family',
        created_at: new Date().toISOString(),
      },
      error: null,
    };
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

  it('with ?next=/app, verifying the code pulls the profile and returns to the patient screen, not the caregiver dashboard', async () => {
    searchParams = new URLSearchParams('next=/app');
    useSettingsStore.setState({ caregiverPinHash: 'existing-hash' });
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null });
    fromResult = {
      data: {
        id: 'c1',
        auth_id: 'test-user',
        display_name: 'ASHA Worker',
        role: 'family',
        created_at: new Date().toISOString(),
      },
      error: null,
    };
    render(<CaregiverLoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send login code/i }));

    fireEvent.change(await screen.findByLabelText(/6-digit code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/app'));
    expect(await db.caregivers.get('c1')).toMatchObject({ displayName: 'ASHA Worker' });
  });

  it('with ?next=/app but no account found yet, still goes to onboarding — there is nothing to show on /app', async () => {
    searchParams = new URLSearchParams('next=/app');
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ data: { session: { user: { id: 'brand-new-user' } } }, error: null });
    render(<CaregiverLoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send login code/i }));

    fireEvent.change(await screen.findByLabelText(/6-digit code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/caregiver/onboarding'));
  });

  it('offers a quick-access PIN setup when a found account has no local PIN yet, then continues to `next`', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null });
    fromResult = {
      data: {
        id: 'c1',
        auth_id: 'test-user',
        display_name: 'ASHA Worker',
        role: 'family',
        created_at: new Date().toISOString(),
      },
      error: null,
    };
    render(<CaregiverLoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send login code/i }));

    fireEvent.change(await screen.findByLabelText(/6-digit code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

    expect(await screen.findByText(/set up quick access/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    for (const digit of ['1', '2', '3', '4']) fireEvent.click(screen.getByRole('button', { name: digit }));
    for (const digit of ['1', '2', '3', '4']) fireEvent.click(screen.getByRole('button', { name: digit }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/caregiver/dashboard'));
    expect(useSettingsStore.getState().caregiverPinHash).not.toBeNull();
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

  it('offers Google sign-in alongside the code, as a full navigation to the server route', () => {
    // Not a client-side signInWithOAuth call — see api/auth/google/route.ts's
    // own comment: doing it client-side let the redirect to Google race the
    // PKCE verifier cookie write. The server route starts the OAuth flow.
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<CaregiverLoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(window.location.href).toBe('/api/auth/google?next=%2Fcaregiver%2Fdashboard');
    expect(signInWithOAuth).not.toHaveBeenCalled();
    expect(signInWithOtp).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('shows the error the server route reports via ?googleError, if Google sign-in could not start', () => {
    searchParams = new URLSearchParams(
      'googleError=' + encodeURIComponent('Unsupported provider: provider is not enabled'),
    );
    render(<CaregiverLoginPage />);

    expect(screen.getByText(/provider is not enabled/i)).toBeInTheDocument();
  });
});

describe('Caregiver login callback page', () => {
  it('exchanges the code, pulls the profile, and redirects to the dashboard for a returning caregiver', async () => {
    // A PIN already on this device means this is a returning caregiver, not
    // a first-ever login — goes straight to `next`, skipping the one-time
    // "set up quick access" PIN step covered separately below.
    useSettingsStore.setState({ caregiverPinHash: 'existing-hash' });
    searchParams = new URLSearchParams('code=abc123');
    exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } },
      error: null,
    });
    fromResult = {
      data: {
        id: 'c1',
        auth_id: 'test-user',
        display_name: 'ASHA Worker',
        role: 'family',
        created_at: new Date().toISOString(),
      },
      error: null,
    };

    render(<CaregiverLoginCallbackPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/caregiver/dashboard'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123');
  });

  it('with ?next=/app, pulls the profile and returns to the patient screen, not the caregiver dashboard', async () => {
    // This is the patient-side login: /app's "Caregiver Login" button links
    // to /caregiver/login with ?next=/app, carried into the emailed link so
    // a device with no local profile yet ends up back on the game screen
    // with data to show, not stranded on the caregiver dashboard.
    searchParams = new URLSearchParams('code=abc123&next=/app');
    useSettingsStore.setState({ caregiverPinHash: 'existing-hash' });
    exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } },
      error: null,
    });
    fromResult = {
      data: {
        id: 'c1',
        auth_id: 'test-user',
        display_name: 'ASHA Worker',
        role: 'family',
        created_at: new Date().toISOString(),
      },
      error: null,
    };

    render(<CaregiverLoginCallbackPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/app'));
    expect(await db.caregivers.get('c1')).toMatchObject({ displayName: 'ASHA Worker' });
  });

  it('with ?next=/app but no account found yet, still goes to onboarding — there is nothing to show on /app', async () => {
    searchParams = new URLSearchParams('code=abc123&next=/app');
    exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: 'brand-new-user' } } },
      error: null,
    });

    render(<CaregiverLoginCallbackPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/caregiver/onboarding'));
  });

  it('offers a quick-access PIN setup when a found account has no local PIN yet, then continues to `next`', async () => {
    // A caregiver returning on a second device (or after Delete All Data)
    // has an account but never set a PIN here — without this step there was
    // no fast way back into caregiver mode afterward, only ever a fresh
    // email login.
    searchParams = new URLSearchParams('code=abc123');
    exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } },
      error: null,
    });
    fromResult = {
      data: {
        id: 'c1',
        auth_id: 'test-user',
        display_name: 'ASHA Worker',
        role: 'family',
        created_at: new Date().toISOString(),
      },
      error: null,
    };

    render(<CaregiverLoginCallbackPage />);

    expect(await screen.findByText(/set up quick access/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    for (const digit of ['1', '2', '3', '4']) fireEvent.click(screen.getByRole('button', { name: digit }));
    for (const digit of ['1', '2', '3', '4']) fireEvent.click(screen.getByRole('button', { name: digit }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/caregiver/dashboard'));
    expect(useSettingsStore.getState().caregiverPinHash).not.toBeNull();
  });

  it('shows an error and a way back to login when the link is expired or already used', async () => {
    searchParams = new URLSearchParams('code=stale-code');
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Token has expired or is invalid' },
    });
    // No fallback session available either — a genuine dead end, not a
    // reused link from an already-signed-in caregiver.
    getSession.mockResolvedValue({ data: { session: null } });

    render(<CaregiverLoginCallbackPage />);

    expect(await screen.findByText(/token has expired or is invalid/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /back to login/i }));
    expect(replace).toHaveBeenCalledWith('/caregiver/login');
  });

  it('shows an error when there is no code in the URL at all and no existing session to fall back to', async () => {
    searchParams = new URLSearchParams();
    getSession.mockResolvedValue({ data: { session: null } });

    render(<CaregiverLoginCallbackPage />);

    expect(await screen.findByText(/invalid or already used/i)).toBeInTheDocument();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('falls back to an existing session instead of hard-failing on a reused/stale link', async () => {
    // A link with no code and no hash tokens (reused from an old tab, or a
    // second copy of the magic-link email opened after the first already
    // completed sign-in) — but this browser already has a live session from
    // that earlier attempt, so it should just continue rather than block a
    // caregiver who is, in fact, already signed in.
    useSettingsStore.setState({ caregiverPinHash: 'existing-hash' });
    searchParams = new URLSearchParams();
    // Default beforeEach getSession already resolves to a valid session.
    fromResult = {
      data: {
        id: 'c1',
        auth_id: 'test-user',
        display_name: 'ASHA Worker',
        role: 'family',
        created_at: new Date().toISOString(),
      },
      error: null,
    };

    render(<CaregiverLoginCallbackPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/caregiver/dashboard'));
    expect(screen.queryByText(/invalid or already used/i)).not.toBeInTheDocument();
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

  it('redirects away from onboarding to the dashboard when a local profile already exists', async () => {
    // Reaching onboarding a second time while a profile is already on this
    // device is exactly how it ends up with two caregiver/patient pairs —
    // nothing to onboard here; Delete All Data is the sanctioned way to
    // really start over.
    pathname = '/caregiver/onboarding';
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'Test Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    render(
      <CaregiverLayout>
        <p>Onboarding form</p>
      </CaregiverLayout>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/caregiver/dashboard'));
  });

  it('self-heals by clearing local data when more than one caregiver profile exists on this device', async () => {
    // Never a valid state under the single-caregiver-per-device model — it
    // means onboarding ran twice without clearing the old profile first.
    // Picking one arbitrarily is exactly how one screen shows the old
    // patient's name while another (server-backed) screen shows the new
    // one.
    await db.caregivers.put({
      id: 'c1',
      authUserId: 'u1',
      displayName: 'Old Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    await db.caregivers.put({
      id: 'c2',
      authUserId: 'u1',
      displayName: 'New Caregiver',
      role: 'family',
      createdAt: new Date().toISOString(),
    });
    await db.patients.put(patient({ id: 'p-old', caregiverId: 'c1', displayName: 'Old Patient' }));
    await db.patients.put(patient({ id: 'p-new', caregiverId: 'c2', displayName: 'New Patient' }));

    render(
      <CaregiverLayout>
        <p>Protected content</p>
      </CaregiverLayout>,
    );

    await waitFor(async () => expect(await db.caregivers.count()).toBe(0));
    expect(await db.patients.count()).toBe(0);
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
    expect(screen.getByLabelText('Step 1 of 4')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Your name'), {
      target: { value: 'Ranjita' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ASHA Worker' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByLabelText('Step 2 of 4')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('checkbox'));
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

    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('on the happy path writes the caregiver, patient and PIN, then navigates home', async () => {
    render(<CaregiverOnboardingPage />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), {
      target: { value: 'Ranjita' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ASHA Worker' }));
    fireEvent.click(screen.getByRole('checkbox'));
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
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }));

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

  it('keeps the caregiver PIN on Log Out, so the same caregiver isn’t forced to set a new one on the next login (#15)', async () => {
    signOut.mockResolvedValue({ error: null });
    await useSettingsStore.getState().setPin('1234');
    const hash = useSettingsStore.getState().caregiverPinHash;

    render(<CaregiverSettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/caregiver/login'));
    expect(useSettingsStore.getState().caregiverPinHash).toBe(hash);
    expect(useSettingsStore.getState().caregiverSessionVerifiedAt).toBeNull();
  });

  it('flushes syncAllPatients() before signOut() on Log Out, so unsynced currentDifficulty reaches the server while the session is still valid (#19)', async () => {
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
    expect(syncAllPatients).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
    // Order matters: syncAllPatients needs the still-live session to
    // authenticate its request — calling it after signOut() makes it a
    // silent no-op (the exact regression this test guards against).
    expect(syncAllPatients.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[0],
    );
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
