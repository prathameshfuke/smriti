'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import appIcon from '@/appicon.png';

type OtpStatus = 'idle' | 'sending' | 'sent' | 'error';
type Role = 'patient' | 'caregiver' | null;

function RoleSelector({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper50 px-4">
      <div className="mx-auto max-w-sm">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-terra600">
          Welcome back
        </p>
        <h1 className="mt-3 flex items-center justify-center gap-3 font-serif-display text-4xl font-medium text-ink950">
          <Image src={appIcon} alt="" width={40} height={40} className="h-10 w-10" priority />
          SMRITI
        </h1>
        <h2 className="mt-8 text-center text-xl text-ink700">Who are you?</h2>

        <button
          type="button"
          onClick={() => onSelect('patient')}
          className="mt-12 flex h-20 w-full flex-col items-center justify-center rounded-control bg-terra600 text-lg font-bold text-paper50 shadow-sm transition-all duration-200 hover:bg-terra700 hover:shadow-md active:scale-[0.97]"
        >
          I am the Patient
          <span className="mt-1 block text-sm font-normal text-paper50/80">Play games</span>
        </button>

        <button
          type="button"
          onClick={() => onSelect('caregiver')}
          className="mt-4 flex h-20 w-full flex-col items-center justify-center rounded-control border-2 border-line200 bg-paper50 text-lg font-bold text-ink950 transition-colors duration-200 hover:border-terra600 hover:bg-paper100 active:scale-[0.97]"
        >
          I am the Caregiver
          <span className="mt-1 block text-sm font-normal text-ink700">Monitor progress</span>
        </button>

        <footer className="mt-12 text-center">
          <p className="text-xs text-ink700">
            SMRITI supports cognitive engagement. It does not diagnose or treat any condition.
          </p>
        </footer>
      </div>
    </div>
  );
}

function PatientSetupFlow() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper50 px-4">
      <div className="mx-auto max-w-sm">
        <h1 className="text-center font-serif-display text-3xl font-medium text-ink950">
          Device Setup Needed
        </h1>
        <p className="mt-6 text-center text-base text-ink700">
          Ask your caregiver to set up this device for you. They&apos;ll do it once, then you can
          start playing games.
        </p>

        <div className="mt-12 rounded-card border border-terra600/25 bg-terra600/8 p-6">
          <p className="text-center text-sm text-ink700">
            Your caregiver will sign in with their email and tap &ldquo;Trust this device.&rdquo;
            After that, you can open SMRITI anytime without needing a code.
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-ink700">
          This makes it easier for you. No codes to remember.
        </p>
      </div>
    </div>
  );
}

function CaregiverOtpFlow() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<OtpStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const submit = async () => {
    if (!isSupabaseConfigured()) {
      setStatus('error');
      setErrorMessage('Sync is not set up on this device yet. Ask your ASHA coordinator.');
      return;
    }
    setStatus('sending');
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/caregiver/dashboard' },
    });
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('sent');
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper50 px-4">
      <div className="mx-auto max-w-sm">
        <h1 className="text-center font-serif-display text-3xl font-medium text-ink950">
          Caregiver Login
        </h1>

        <label htmlFor="caregiver-email" className="sr-only">
          Email address
        </label>
        <input
          id="caregiver-email"
          type="email"
          autoComplete="off"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-8 h-14 w-full rounded-control border-2 border-line200 bg-paper50 px-4 text-base text-ink950 transition-colors focus:border-terra600 focus:outline-none focus:ring-2 focus:ring-terra600/25"
        />

        <div className="mt-6">
          <BigButton
            label="Send Login Link"
            variant="primary"
            disabled={status === 'sending'}
            onClick={() => void submit()}
          />
        </div>

        {status === 'sent' ? (
          <>
            <p className="mt-4 text-center font-bold text-success">Check your email</p>
            <p className="mt-2 text-center text-sm text-ink700">Expires in 10 minutes</p>
            <button
              type="button"
              onClick={() => void submit()}
              className="mt-4 block w-full text-center text-sm text-terra600 underline"
            >
              Resend?
            </button>
          </>
        ) : null}

        {status === 'error' ? (
          <p role="alert" className="mt-4 text-center font-bold text-danger">
            {errorMessage || "That didn't work. Try again."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role');
  const [role, setRole] = useState<Role>(
    initialRole === 'patient' || initialRole === 'caregiver' ? initialRole : null,
  );

  const selectRole = (next: Role) => {
    setRole(next);
    if (next) router.replace(`/login?role=${next}`);
  };

  if (role === 'patient') return <PatientSetupFlow />;
  if (role === 'caregiver') return <CaregiverOtpFlow />;
  return <RoleSelector onSelect={selectRole} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
