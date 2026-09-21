'use client';

import { useEffect, useState } from 'react';
import { restoreLocalSession } from '@/lib/auth/localSession';
import { usePatientStore } from '@/stores/patientStore';
import { useTranslation } from '@/lib/i18n/provider';

/** A restore that finishes inside this is invisible; a slower one says so. */
const SHOW_LOADING_AFTER_MS = 400;

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
  const [slow, setSlow] = useState(false);
  const { t } = useTranslation();

  // A blank screen reads as a frozen app to an older patient. Only when the
  // wait is noticeable, say plainly that something is happening.
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setSlow(true), SHOW_LOADING_AFTER_MS);
    return () => clearTimeout(id);
  }, [ready]);

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

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface px-6 text-center" aria-busy="true">
        {slow ? (
          <p role="status" className="text-patient-body text-ink-muted">
            {t('common.loading')}
          </p>
        ) : null}
      </div>
    );
  }
  return <>{children}</>;
}
