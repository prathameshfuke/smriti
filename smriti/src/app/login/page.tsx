'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import appIcon from '@/appicon.png';

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

/**
 * This page used to carry its own patient/caregiver flows — a dead-end
 * "ask your caregiver" screen for patient with no logic behind it at all,
 * and a caregiver flow stuck on the old link-only OTP email (no code entry,
 * no way to complete login in the tab that requested it). Both are gone:
 * `/app` already does the real thing for a patient (checks local storage,
 * restores instantly if this device is set up, or offers Caregiver Login if
 * not), and `/caregiver/login` already carries the fixed email+code flow.
 * Keeping a second, divergent copy of either is exactly how they drift out
 * of sync with real fixes made in one place but not the other.
 */
function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role');
  const [role, setRole] = useState<Role>(
    initialRole === 'patient' || initialRole === 'caregiver' ? initialRole : null,
  );

  useEffect(() => {
    if (role === 'patient') router.replace('/app');
    else if (role === 'caregiver') router.replace('/caregiver/login');
  }, [role, router]);

  if (role) return null;
  return <RoleSelector onSelect={setRole} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
