'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import Disclaimer from '@/components/layout/Disclaimer';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useSettingsStore } from '@/stores/settingsStore';

type OtpStatus = 'idle' | 'sending' | 'sent' | 'error';
type Role = 'patient' | 'caregiver' | null;
const PIN_LENGTH = 4;

function RoleSelector({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="max-w-sm">
        <h1 className="text-center font-serif-display text-3xl font-bold text-ink">SMRITI</h1>
        <h2 className="mt-8 text-center font-sans text-subheadline text-ink-muted">
          Who are you?
        </h2>

        <div className="mt-12 flex flex-col gap-6">
          <BigButton label="I am the Patient" variant="primary" onClick={() => onSelect('patient')} />
          <BigButton
            label="I am the Caregiver"
            variant="secondary"
            onClick={() => onSelect('caregiver')}
          />
        </div>

        <div className="mt-12 [&>footer]:px-0 [&>footer]:text-xs">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}

function PatientPinFlow() {
  const router = useRouter();
  const verifyPin = useSettingsStore((s) => s.verifyPin);
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState(false);

  const pin = digits.join('');

  const onDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(false);
  };

  const submit = async () => {
    const ok = await verifyPin(pin);
    if (ok) {
      router.push('/');
      return;
    }
    setError(true);
    setDigits(Array(PIN_LENGTH).fill(''));
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="max-w-sm">
        <h1 className="text-center font-serif-display text-headline text-ink">Enter your PIN</h1>
        <p className="mt-4 text-center font-sans text-body-lg text-ink-muted">
          Your caregiver set up this PIN.
        </p>

        <div className="mt-12 flex justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              type="tel"
              maxLength={1}
              inputMode="numeric"
              aria-label={`PIN digit ${i + 1}`}
              value={d}
              onChange={(e) => onDigitChange(i, e.target.value)}
              className="h-16 w-16 rounded-card border-2 border-ink text-center text-2xl font-bold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ))}
        </div>

        {error ? (
          <p role="status" className="mt-4 text-center font-sans text-body text-danger">
            That PIN didn&apos;t work. Try again.
          </p>
        ) : null}

        <div className="mt-8">
          <BigButton
            label="Continue"
            variant="primary"
            disabled={pin.length < PIN_LENGTH}
            onClick={() => void submit()}
          />
        </div>

        <p className="mt-4 text-center font-sans text-sm text-ink-muted underline">
          Don&apos;t remember? Ask your caregiver.
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
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="max-w-sm">
        <h1 className="text-center font-serif-display text-headline text-ink">
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
          className="mt-8 h-14 w-full rounded-card border-2 border-surface-muted px-4 font-sans text-body"
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
            <p className="mt-4 text-center font-sans font-bold text-success">Check your email ✓</p>
            <p className="mt-2 text-center font-sans text-xs text-ink-muted">
              Expires in 10 minutes
            </p>
          </>
        ) : null}

        {status === 'error' ? (
          <p role="alert" className="mt-4 text-center font-sans text-danger">
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

  if (role === 'patient') return <PatientPinFlow />;
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
