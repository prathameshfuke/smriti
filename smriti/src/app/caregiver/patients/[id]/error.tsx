'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { buttonClass, textActionClass } from '@/components/ui/Panel';

/**
 * Fallback for anything that throws while one patient's view renders. Without
 * this, a render error here went all the way up to Next's built-in "This page
 * couldn't load" screen, which drops the caregiver shell and all navigation.
 * The caregiver layout above stays mounted, so the nav is still there.
 */
export default function PatientDetailError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[patient-detail]', error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-dashboard px-5 pt-5 pb-10 md:px-10 md:pt-10">
      <Link href="/caregiver/patients" className={textActionClass}>
        All patients
      </Link>
      <div role="alert" className="mt-4 flex max-w-md flex-col gap-4">
        <h1 className="font-serif-display text-[1.875rem] font-medium leading-[1.1] text-ink">
          Couldn&apos;t load this patient
        </h1>
        <p className="text-caregiver-body text-ink-muted">
          Something went wrong while opening their details. Their information is safe. Try again.
        </p>
        <button type="button" onClick={() => retry()} className={`${buttonClass.primary} self-start`}>
          Try again
        </button>
      </div>
    </main>
  );
}
