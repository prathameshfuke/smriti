'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

type Status = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Magic-link-only login: no in-app code entry. Supabase emails a link to
 * `/caregiver/login/callback`, which exchanges the PKCE `code` query param
 * for a session, pulls the caregiver profile, and handles first-time PIN
 * setup — everything that used to happen here after `verifyOtp` now happens
 * there instead, since a clicked link (not a typed code) is what starts it.
 *
 * The link must be opened on the same device/browser that requested it —
 * PKCE's code verifier lives in this browser's storage, not in the email.
 */
function CaregiverLoginPageInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/caregiver/dashboard';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const sendLink = async () => {
    setErrorMessage('');
    if (!isSupabaseConfigured()) {
      setStatus('error');
      setErrorMessage('Sync is not set up on this device yet. Ask your ASHA coordinator.');
      return;
    }

    setStatus('sending');
    const redirectTo = `${window.location.origin}/caregiver/login/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createBrowserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }

    setStatus('sent');
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-patient flex-col justify-center gap-6 px-4 py-6">
      <div className="text-center">
        <h1 className="font-serif-display text-caregiver-heading font-semibold text-ink">
          Caregiver Login
        </h1>
        <p className="mt-2 text-caregiver-body text-ink-muted">
          {status === 'sent'
            ? `We sent a login link to ${email}. Open it on this device to continue.`
            : 'Enter your email to receive a login link'}
        </p>
      </div>

      {status === 'sent' ? (
        <button
          type="button"
          onClick={() => {
            setStatus('idle');
            setErrorMessage('');
          }}
          className="text-center text-caregiver-body text-ink-muted underline"
        >
          Use a different email
        </button>
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
            label={status === 'sending' ? 'Sending…' : 'Send Login Link'}
            variant="primary"
            disabled={status === 'sending' || !email}
            onClick={sendLink}
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
