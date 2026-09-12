'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import PinPad from '@/components/ui/PinPad';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { pullAndStoreServerProfile } from '@/lib/auth/localSession';
import { useSettingsStore } from '@/stores/settingsStore';

type Status = 'idle' | 'sending' | 'sent' | 'verifying' | 'error' | 'setup-pin';

const OTP_LENGTH = 6;
const PIN_LENGTH = 4;

/**
 * Two ways in, side by side: email + 6-digit code (verified on this one
 * page, in one request — no redirect, no callback route, no cookie needing
 * to survive a hop across sites, since the caregiver carries the code over
 * themselves by typing it), and Google sign-in (via `GET /api/auth/google`
 * — see that route's own comment for why it's server-side, not a client
 * `signInWithOAuth` call).
 *
 * The code path exists because Google's redirect chain (this site →
 * Supabase → Google → Supabase → this site) hits a real Safari/WebKit
 * cookie bug that isn't fixable from this app's code (bugs.webkit.org
 * #196375, #219650) — code entry has none of that surface area, so it's
 * the one guaranteed-to-work fallback regardless of browser.
 *
 * Requires the Supabase project's Magic Link email template to include
 * `{{ .Token }}` (Authentication → Email Templates → Magic Link in the
 * Supabase dashboard) — the default template only has a link, no code, so
 * the email arrives with nothing to type in here until that's changed.
 */
function CaregiverLoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/caregiver/dashboard';
  const googleError = searchParams.get('googleError');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState(googleError ? decodeURIComponent(googleError) : '');
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStage, setPinStage] = useState<'new' | 'confirm'>('new');
  const [pinError, setPinError] = useState('');

  const sendCode = async () => {
    setErrorMessage('');
    if (!isSupabaseConfigured()) {
      setStatus('error');
      setErrorMessage('Sync is not set up on this device yet. Ask your ASHA coordinator.');
      return;
    }

    setStatus('sending');
    const { error } = await createBrowserClient().auth.signInWithOtp({ email });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }

    setStatus('sent');
  };

  const signInWithGoogle = () => {
    setErrorMessage('');
    // A full browser navigation, deliberately — not an internal page (the
    // lint rule below assumes it is), a Route Handler that issues its own
    // HTTP redirect to Google.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
  };

  const verifyCode = async () => {
    setErrorMessage('');
    setStatus('verifying');
    const { data, error } = await createBrowserClient().auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });

    if (error || !data.session) {
      setStatus('sent');
      setErrorMessage(error?.message ?? 'Could not verify that code. Try again.');
      return;
    }

    const result = await pullAndStoreServerProfile(data.session.user.id);

    if (result === 'error') {
      setStatus('sent');
      setErrorMessage('Signed in, but could not reach your account details. Check your connection and try again.');
      return;
    }

    if (result === 'not_found') {
      // Onboarding sets its own PIN as part of setup — nothing more to do.
      router.replace('/caregiver/onboarding');
      return;
    }

    useSettingsStore.getState().markCaregiverSessionVerified();

    if (useSettingsStore.getState().caregiverPinHash) {
      router.replace(next);
      return;
    }

    setPendingDestination(next);
    setStatus('setup-pin');
  };

  const onPinDigit = async (digit: string) => {
    setPinError('');

    if (pinStage === 'new') {
      const nextNewPin = newPin.length < PIN_LENGTH ? newPin + digit : newPin;
      setNewPin(nextNewPin);
      if (nextNewPin.length === PIN_LENGTH) setPinStage('confirm');
      return;
    }

    const nextConfirmPin = confirmPin.length < PIN_LENGTH ? confirmPin + digit : confirmPin;
    setConfirmPin(nextConfirmPin);
    if (nextConfirmPin.length !== PIN_LENGTH) return;

    if (nextConfirmPin !== newPin) {
      setPinError('PINs do not match');
      setNewPin('');
      setConfirmPin('');
      setPinStage('new');
      return;
    }

    await useSettingsStore.getState().setPin(nextConfirmPin);
    router.replace(pendingDestination ?? next);
  };

  const onPinBackspace = () => {
    setPinError('');
    if (pinStage === 'new') setNewPin((p) => p.slice(0, -1));
    else setConfirmPin((p) => p.slice(0, -1));
  };

  const skipPinSetup = () => {
    router.replace(pendingDestination ?? next);
  };

  if (status === 'setup-pin') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-patient flex-col justify-center gap-4 px-4 py-6">
        <div className="text-center">
          <h1 className="font-serif-display text-caregiver-heading font-semibold text-ink">
            Set Up Quick Access
          </h1>
          <p className="mt-2 text-caregiver-body text-ink-muted">
            {pinStage === 'new'
              ? 'Create a 4-digit PIN for a fast way back into the caregiver area on this device'
              : 'Confirm PIN'}
          </p>
        </div>

        <div className="flex justify-center gap-3" aria-hidden="true">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-14 w-14 rounded-card border-2 transition-colors duration-200 ${
                i < (pinStage === 'new' ? newPin.length : confirmPin.length)
                  ? 'border-primary bg-primary'
                  : 'border-line200'
              }`}
            />
          ))}
        </div>

        <PinPad onDigit={onPinDigit} onBackspace={onPinBackspace} />

        {pinError ? <p className="text-center text-caregiver-body text-warning">{pinError}</p> : null}

        <button
          type="button"
          onClick={skipPinSetup}
          className="text-center text-caregiver-body text-ink-muted underline"
        >
          Skip for now
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-patient flex-col justify-center gap-6 px-4 py-6">
      <div className="text-center">
        <h1 className="font-serif-display text-caregiver-heading font-semibold text-ink">
          Caregiver Login
        </h1>
        <p className="mt-2 text-caregiver-body text-ink-muted">
          {status === 'sent' || status === 'verifying'
            ? 'Enter the 6-digit code we emailed you'
            : 'Enter your email to receive a login code'}
        </p>
      </div>

      {status === 'sent' || status === 'verifying' ? (
        <div className="flex flex-col gap-4">
          <label htmlFor="caregiver-code" className="sr-only">
            6-digit code
          </label>
          <input
            id="caregiver-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="h-14 w-full rounded-card border border-line200 px-4 text-center text-caregiver-heading tracking-[0.3em] text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <BigButton
            label={status === 'verifying' ? 'Verifying…' : 'Verify code'}
            variant="primary"
            disabled={status === 'verifying' || code.length !== OTP_LENGTH}
            onClick={verifyCode}
          />

          <button
            type="button"
            onClick={() => {
              setStatus('idle');
              setCode('');
              setErrorMessage('');
            }}
            className="text-center text-caregiver-body text-ink-muted underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label htmlFor="caregiver-email" className="sr-only">
            Email
          </label>
          <input
            id="caregiver-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-14 w-full rounded-card border border-line200 px-4 text-caregiver-body text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <BigButton
            label={status === 'sending' ? 'Sending…' : 'Send login code'}
            variant="primary"
            disabled={status === 'sending' || !email}
            onClick={sendCode}
          />

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-surface-muted" />
            <span className="text-caregiver-body text-ink-muted">or</span>
            <span className="h-px flex-1 bg-surface-muted" />
          </div>

          <BigButton
            label="Continue with Google"
            variant="secondary"
            disabled={status === 'sending'}
            onClick={signInWithGoogle}
          />
        </div>
      )}

      {errorMessage ? (
        <p className="text-center text-caregiver-body text-warning">{errorMessage}</p>
      ) : null}
    </main>
  );
}

export default function CaregiverLoginPage() {
  return (
    <Suspense fallback={null}>
      <CaregiverLoginPageInner />
    </Suspense>
  );
}
