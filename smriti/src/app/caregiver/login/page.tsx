'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

type Status = 'idle' | 'sending' | 'sent' | 'verifying' | 'error';

const OTP_LENGTH = 6;

/**
 * Verifying the 6-digit code typed in-app (not clicking the emailed link) is
 * the login path, not a fallback for it. A clicked magic link only
 * establishes a session in whatever browser/tab opens it — often not this
 * one — and corporate mail scanners that pre-fetch every link in an email
 * silently consume the one-time code before the caregiver ever clicks it,
 * so the "real" click lands back on a login-like screen with nothing to
 * show for it. The code has no such failure mode: it is verified right here
 * in the same tab that requested it.
 */
export default function CaregiverLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

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

  const verifyCode = async () => {
    setErrorMessage('');
    setStatus('verifying');
    const { error } = await createBrowserClient().auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });

    if (error) {
      setStatus('sent');
      setErrorMessage(error.message);
      return;
    }

    router.replace('/caregiver/dashboard');
  };

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
            className="h-14 w-full rounded-card border border-gray-200 px-4 text-center text-caregiver-heading tracking-[0.3em] text-ink shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <BigButton
            label={status === 'verifying' ? 'Verifying…' : 'Verify Code'}
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
            className="h-14 w-full rounded-card border border-gray-200 px-4 text-caregiver-body text-ink shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <BigButton
            label={status === 'sending' ? 'Sending…' : 'Send Login Code'}
            variant="primary"
            disabled={status === 'sending' || !email}
            onClick={sendCode}
          />
        </div>
      )}

      {errorMessage ? (
        <p className="text-center text-caregiver-body text-warning">{errorMessage}</p>
      ) : null}
    </main>
  );
}
