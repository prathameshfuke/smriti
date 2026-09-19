'use client';

import { useEffect, useState } from 'react';
import { restoreLocalSession } from '@/lib/auth/localSession';
import { usePatientStore } from '@/stores/patientStore';

/**
 * Restores the device's patient from local storage before a patient screen
 * renders.
 *
 * The patient store is in memory only and was filled by the home screen
 * (`/app`) alone. Opening a game, Reminders or Ask Smriti directly — a
 * reload, the PWA relaunching on the last screen, a bookmark — left it empty:
 * games played at level 1 and silently saved no score, and Reminders showed
 * none. Game screens read the patient once on mount, so this waits for the
 * restore instead of letting them start without one. It reads IndexedDB
 * only, so it is quick and needs no network.
 */
export default function PatientSessionGate({ children }: { children: React.ReactNode }) {
  const hasPatient = usePatientStore((s) => s.currentPatient !== null);
  const [ready, setReady] = useState(hasPatient);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    restoreLocalSession()
      .catch((err) => console.error('[session] local restore failed', err))
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) return <div className="min-h-dvh bg-surface" aria-busy="true" />;
  return <>{children}</>;
}
