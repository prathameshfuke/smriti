'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import appIcon from '@/appicon.png';
import { useTranslation } from '@/lib/i18n/provider';

type Role = 'patient' | 'caregiver' | null;

function RoleSelector({ onSelect }: { onSelect: (role: Role) => void }) {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh flex-col bg-paper50 px-5 py-8">
      <p className="flex items-center gap-2.5 font-serif-display text-[1.375rem] font-medium text-ink950">
        <Image src={appIcon} alt="" width={28} height={28} className="h-7 w-7" priority />
        SMRITI
      </p>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <h1 className="font-serif-display text-[2.5rem] font-medium leading-[1.1] text-ink950">{t('login.title')}</h1>
        <p className="mt-3 text-patient-body text-ink700">{t('login.subtitle')}</p>

        <div className="mt-10 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => onSelect('patient')}
            className="flex min-h-24 w-full flex-col items-start justify-center rounded-card bg-terra600 px-6 py-4 text-left text-paper50 transition-[transform,background-color] duration-150 hover:bg-terra700 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <span className="text-patient-body font-bold">{t('login.patient')}</span>
            <span className="mt-1 text-caregiver-body text-paper50/90">{t('login.patientHint')}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelect('caregiver')}
            className="flex min-h-24 w-full flex-col items-start justify-center rounded-card border-2 border-ink700 bg-white px-6 py-4 text-left text-ink950 transition-[transform,background-color] duration-150 hover:bg-paper100 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <span className="text-patient-body font-bold">{t('login.caregiver')}</span>
            <span className="mt-1 text-caregiver-body text-ink700">{t('login.caregiverHint')}</span>
          </button>
        </div>
      </div>
    </main>
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
