'use client';

import { Suspense, useState } from 'react';
import appIcon from '@/appicon.png';
import { useSearchParams } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import { fieldClass, labelClass, textActionClass } from '@/components/ui/Panel';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

type Status = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Two ways in, side by side: email + magic link (sent via `signInWithOtp`,
 * landing on `caregiver/login/callback` to finish the sign-in and, for a
 * first-time caregiver, set up their PIN), and Google sign-in (via
 * `GET /api/auth/google` — see that route's own comment for why it's
 * server-side, not a client `signInWithOAuth` call).
 *
 * The link needs an explicit `emailRedirectTo` pointing at the callback
 * route, and that exact URL added to Supabase's Redirect URLs allow list
 * (Authentication → URL Configuration) — otherwise Supabase silently falls
 * back to the bare Site URL and the callback page never runs.
 *
 * There used to be an in-app 6-digit code path alongside the link, for a
 * Magic Link email template customized to include `{{ .Token }}`. Dropped:
 * editing that template needs custom SMTP configured first (the default
 * Supabase email provider doesn't allow template edits), so on an
 * unconfigured project the code box always had nothing to type into it.
 */
function CaregiverLoginPageInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/caregiver/dashboard';
  const googleError = searchParams.get('googleError');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState(googleError ? decodeURIComponent(googleError) : '');

  const sendLink = async () => {
    setErrorMessage('');
    if (!isSupabaseConfigured()) {
      setStatus('error');
      setErrorMessage('Sync is not set up on this device yet. Ask your ASHA coordinator.');
      return;
    }

    setStatus('sending');
    const { error } = await createBrowserClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/caregiver/login/callback?next=${encodeURIComponent(next)}`,
      },
    });

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

  const sent = status === 'sent';

  return (
    <AuthShell
      title="Caregiver Login"
      description={sent ? `Tap the sign-in link we emailed to ${email || 'you'}.` : 'Enter your email to receive a sign-in link'}
    >
      {sent ? (
        <button
          type="button"
          onClick={() => {
            setStatus('idle');
            setErrorMessage('');
          }}
          className={`${textActionClass} self-start`}
        >
          Use a different email
        </button>
      ) : (
        <>
          <div>
            <label htmlFor="caregiver-email" className={labelClass}>
              Email
            </label>
            <input
              id="caregiver-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={fieldClass}
            />
          </div>

          <BigButton
            label={status === 'sending' ? 'Sending…' : 'Send login link'}
            variant="primary"
            disabled={status === 'sending' || !email}
            onClick={sendLink}
          />

          <div className="flex items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1 bg-line200" />
            <span className="text-caregiver-body text-ink-muted">or</span>
            <span className="h-px flex-1 bg-line200" />
          </div>

          <BigButton
            label="Continue with Google"
            variant="secondary"
            disabled={status === 'sending'}
            onClick={signInWithGoogle}
          />
        </>
      )}

      {errorMessage ? (
        <p role="alert" className="text-caregiver-body font-bold text-danger">
          {errorMessage}
        </p>
      ) : null}
    </AuthShell>
  );
}

/** Shared frame for the sign-in steps: brand at the top, one left-aligned
 * column in the middle, never more than one decision on screen. */
function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-surface px-5 py-8">
      <p className="flex items-center gap-2.5 font-serif-display text-[1.375rem] font-medium text-ink">
        {/* eslint-disable-next-line @next/next/no-img-element -- 28px static brand mark, nothing to optimise */}
        <img src={appIcon.src} alt="" width={28} height={28} className="h-7 w-7" />
        SMRITI
      </p>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <h1 className="font-serif-display text-[2.25rem] font-medium leading-[1.1] text-ink">{title}</h1>
        <p className="mt-3 text-caregiver-body text-ink-muted">{description}</p>
        <div className="mt-8 flex flex-col gap-5">{children}</div>
      </div>
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
