'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AnimatedSwitch from '@/components/ui/AnimatedSwitch';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import { buttonClass, textActionClass } from '@/components/ui/Panel';
import PatientAvatar from '@/components/patient/PatientAvatar';
import { db, type LocalPatient } from '@/lib/db/schema';
import { getTrustedPatientIds, removeDeviceTrust, setDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { getDevicePatients } from '@/lib/auth/localSession';
import { useLiveQuery } from 'dexie-react-hooks';
import { pullCaregiverProfile } from '@/lib/db/serverProfile';
import { createBrowserClient } from '@/lib/supabase/client';
import { languageName } from '@/lib/i18n/languages';
import { PhotoTooLargeError, removePatientPhoto, savePatientPhoto } from '@/lib/patients/photos';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';

type RowState = { busy: boolean; error: string | null };

/**
 * People on this phone: which of the caregiver's patients play SMRITI here.
 * One chosen person makes this their phone; several make it a shared phone
 * that asks "Who is playing?" when opened. A phone that signs in to an
 * account with several patients is sent here first (see caregiver/layout.tsx),
 * so a caregiver's whole list never lands on one patient's phone.
 */
function DevicePatientsInner() {
  const router = useRouter();
  const isSetup = useSearchParams().get('setup') === '1';

  const [patients, setPatients] = useState<LocalPatient[] | null>(null);
  const [onPhone, setOnPhone] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Record<string, RowState>>({});
  /** A phone set up before shared phones: its one patient has no per-patient
   * link, yet is still this phone's patient (see getDevicePatients). */
  const [implicitId, setImplicitId] = useState<string | null>(null);
  const photoIds = useLiveQuery(async () => new Set(await db.patientPhotos.toCollection().primaryKeys()), [], new Set<string>());

  const refreshOnPhone = async () => {
    const [device, trusted] = await Promise.all([getDevicePatients(), getTrustedPatientIds()]);
    setOnPhone(new Set(device.map((p) => p.id)));
    setImplicitId(device.length === 1 && !trusted.includes(device[0].id) ? device[0].id : null);
  };

  const reload = useCallback(async () => {
    const caregiver = await db.caregivers.toCollection().first();
    if (!caregiver) {
      setPatients([]);
      return;
    }
    const local = await db.patients
      .where('caregiverId')
      .equals(caregiver.id)
      .filter((p) => p.isActive)
      .toArray();
    setPatients(local.sort((a, b) => a.displayName.localeCompare(b.displayName)));
    await refreshOnPhone();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await reload();
      // Pick up patients added from another phone since this one last
      // signed in. Only fills in rows; never changes who is playing.
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const { data } = await createBrowserClient().auth.getSession();
      const userId = data.session?.user.id;
      if (!userId || cancelled) return;
      const pulled = await pullCaregiverProfile(userId);
      if (pulled.status !== 'found' || cancelled) return;

      // A phone whose one patient was never linked (set up before shared
      // phones, or offline) counts that patient implicitly. Downloading more
      // patients would end that and leave the patient's home asking a
      // caregiver to choose, so link the existing patient first, and if that
      // can't be done, only refresh rows this phone already has.
      const localIds = new Set((await db.patients.toArray()).map((p) => p.id));
      const [devicePatients, trusted] = await Promise.all([getDevicePatients(), getTrustedPatientIds()]);
      const implicit = devicePatients.length === 1 && !trusted.includes(devicePatients[0].id) ? devicePatients[0] : null;
      let rows = pulled.patients;
      if (implicit && rows.some((p) => p.isActive && !localIds.has(p.id))) {
        try {
          await setDeviceTrustToken(implicit.id);
        } catch {
          rows = rows.filter((p) => localIds.has(p.id));
        }
      }
      const reminderPatientIds = new Set(rows.map((p) => p.id));

      await db.transaction('rw', db.patients, db.reminderSchedules, async () => {
        await db.patients.bulkPut(rows);
        const reminders = pulled.reminders.filter((r) => reminderPatientIds.has(r.patientId));
        if (reminders.length) await db.reminderSchedules.bulkPut(reminders);
      });
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const setRow = (id: string, next: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { busy: false, error: null }), ...next } }));

  const toggle = async (patient: LocalPatient, next: boolean) => {
    setRow(patient.id, { busy: true, error: null });
    try {
      if (next) {
        await setDeviceTrustToken(patient.id);
      } else {
        await removeDeviceTrust(patient.id);
        const settings = useSettingsStore.getState();
        if (settings.activePatientId === patient.id) settings.setActivePatient(null);
        if (usePatientStore.getState().currentPatient?.id === patient.id) {
          usePatientStore.getState().setCurrentPatient(null);
        }
      }
      // Linking a second person to a phone whose first patient has no
      // per-patient link yet: link the first one too, so they stay on it.
      if (next && implicitId && implicitId !== patient.id) {
        await setDeviceTrustToken(implicitId);
      }
      await refreshOnPhone();
      setRow(patient.id, { busy: false });
    } catch {
      setRow(patient.id, {
        busy: false,
        error: next ? 'Could not link this phone. Connect to the internet and try again.' : 'Could not update. Try again.',
      });
    }
  };

  const onPhoto = async (patient: LocalPatient, file: File | undefined) => {
    if (!file) return;
    setRow(patient.id, { busy: true, error: null });
    try {
      await savePatientPhoto(patient.id, file);
      setRow(patient.id, { busy: false });
    } catch (err) {
      setRow(patient.id, {
        busy: false,
        error: err instanceof PhotoTooLargeError ? 'That photo is too large. Choose one under 10MB.' : 'Could not use that photo.',
      });
    }
  };

  const chosen = patients?.filter((p) => onPhone.has(p.id)) ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        before={
          isSetup ? null : (
            <Link href="/caregiver/settings" className={`${textActionClass} mb-2`}>
              Settings
            </Link>
          )
        }
        title={isSetup ? 'Who uses this phone?' : 'People on this phone'}
        description="Choose who plays SMRITI here. If you choose more than one person, the phone asks who is playing each time it is opened."
      />

      {patients === null ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton height={96} />
          <Skeleton height={96} />
        </div>
      ) : patients.length === 0 ? (
        <p className="text-caregiver-body text-ink-muted">No patients on this account yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {patients.map((patient) => {
            const row = rows[patient.id] ?? { busy: false, error: null };
            const active = onPhone.has(patient.id);
            return (
              <li
                key={patient.id}
                className={`flex flex-col gap-4 rounded-card border bg-surface-card p-4 ${active ? 'border-primary/50' : 'border-line200'}`}
              >
                <div className="flex items-center gap-4">
                  <PatientAvatar patientId={patient.id} name={patient.displayName} size={60} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-caregiver-body font-bold text-ink">{patient.displayName}</p>
                    <p className="text-patient-sm text-ink-muted">
                      Age {patient.ageYears}, {languageName(patient.primaryLanguage)}
                    </p>
                  </div>
                  <AnimatedSwitch
                    checked={active}
                    disabled={row.busy || implicitId === patient.id}
                    onChange={(next) => void toggle(patient, next)}
                    label={`${patient.displayName} uses this phone`}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line200 pt-3">
                  <span className="text-patient-sm font-bold text-ink">
                    {implicitId === patient.id ? 'Uses this phone (the only one)' : active ? 'Uses this phone' : 'Not on this phone'}
                  </span>
                  <span className="flex gap-2">
                    <label className={`${buttonClass.secondary} cursor-pointer px-4 focus-within:outline focus-within:outline-3 focus-within:outline-primary-dark`}>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          void onPhoto(patient, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      {photoIds.has(patient.id) ? 'Change photo' : 'Add photo'}
                    </label>
                    {photoIds.has(patient.id) ? (
                      <button
                        type="button"
                        onClick={() => void removePatientPhoto(patient.id)}
                        className={`${textActionClass} px-2 text-ink-muted decoration-ink-muted/40`}
                      >
                        Remove photo
                      </button>
                    ) : null}
                  </span>
                </div>
                {row.error ? (
                  <p role="alert" className="text-patient-sm font-bold text-danger">
                    {row.error}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {patients && patients.length > 0 ? (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => router.push('/app')}
            className={`${buttonClass.primary} min-h-14 sm:flex-1`}
          >
            {chosen.length === 0 ? 'Choose at least one person' : 'Go to patient view'}
          </button>
          <Link href="/caregiver/add-patient" className={`${buttonClass.secondary} min-h-14 sm:flex-1`}>
            Add someone new
          </Link>
        </div>
      ) : null}
    </main>
  );
}

export default function DevicePatientsPage() {
  return (
    <Suspense fallback={null}>
      <DevicePatientsInner />
    </Suspense>
  );
}
