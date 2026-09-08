'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import PinPad from '@/components/ui/PinPad';
import { createBrowserClient } from '@/lib/supabase/client';
import { pullAndStoreServerProfile } from '@/lib/auth/localSession';
import { useSettingsStore } from '@/stores/settingsStore';

type Status = 'verifying' | 'error' | 'setup-pin';

const PIN_LENGTH = 4;

/**
 * Landing point for the caregiver login magic link (see
 * `caregiver/login/page.tsx`). Establishes the session, then does the same
 * profile-pull + first-time-PIN-setup work the old in-app OTP verify used to
 * do — this is now the one place a login actually completes.
 *
 * Two different link shapes land here with a session to establish, not one:
 * a real caregiver clicking the emailed link goes through the browser's own
 * PKCE flow (started by `signInWithOtp`'s `emailRedirectTo`), which comes
 * back with a `?code=` query param to exchange. An admin-generated link
 * (`auth.admin.generateLink`, used to hand someone a working login when
 * Supabase's email rate limit blocks sending the real one) never went
 * through that browser-side PKCE handshake, so Supabase redirects it the
 * older way instead — tokens in the URL hash fragment
 * (`#access_token=...&refresh_token=...`), which a `?code=` check alone
 * misses entirely and reports as "invalid or already used" even though the
 * link just worked.
 */
function CaregiverLoginCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/caregiver/dashboard';
  const code = searchParams.get('code');

  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStage, setPinStage] = useState<'new' | 'confirm'>('new');
  const [pinError, setPinError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const finish = async () => {
      const supabase = createBrowserClient();
      let sessionError: { message: string } | null = null;
      let userId: string | undefined;

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        sessionError = error;
        userId = data.session?.user.id;
      } else {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (!accessToken || !refreshToken) {
          setStatus('error');
          setErrorMessage('This login link is invalid or already used. Request a new one.');
          return;
        }

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        sessionError = error;
        userId = data.session?.user.id;
      }

      if (sessionError || !userId) {
        setStatus('error');
        setErrorMessage(
          sessionError?.message ??
            'This login link has expired or was already used. Request a new one.',
        );
        return;
      }

      const result = await pullAndStoreServerProfile(userId);

      if (result === 'error') {
        setStatus('error');
        setErrorMessage(
          'Signed in, but could not reach your account details. Check your connection and try again.',
        );
        return;
      }

      if (result === 'not_found') {
        // Onboarding sets its own PIN as part of setup — nothing more to do.
        router.replace('/caregiver/onboarding');
        return;
      }

      // Anchors the PIN's freshness check (see
      // `settingsStore.isCaregiverSessionFresh`) regardless of whether a PIN
      // gets set below.
      useSettingsStore.getState().markCaregiverSessionVerified();

      if (useSettingsStore.getState().caregiverPinHash) {
        router.replace(next);
        return;
      }

      setStatus('setup-pin');
    };

    void finish();
  }, [code, next, router]);

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
    router.replace(next);
  };

  const onPinBackspace = () => {
    setPinError('');
    if (pinStage === 'new') setNewPin((p) => p.slice(0, -1));
    else setConfirmPin((p) => p.slice(0, -1));
  };

  const skipPinSetup = () => {
    router.replace(next);
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
                  : 'border-gray-200'
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
          {status === 'error' ? 'Login link problem' : 'Signing you in…'}
        </h1>
        {errorMessage ? (
          <p className="mt-2 text-caregiver-body text-warning">{errorMessage}</p>
        ) : null}
      </div>

      {status === 'error' ? (
        <BigButton
          label="Back to Login"
          variant="primary"
          onClick={() => router.replace('/caregiver/login')}
        />
      ) : null}
    </main>
  );
}

export default function CaregiverLoginCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CaregiverLoginCallbackInner />
    </Suspense>
  );
}
