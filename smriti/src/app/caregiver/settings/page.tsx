'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import LanguagePicker from '@/components/layout/LanguagePicker';
import FaqTabsCard from '@/components/ui/FaqTabsCard';
import PinPad from '@/components/ui/PinPad';
import { createBrowserClient } from '@/lib/supabase/client';
import { db, SmritiDB } from '@/lib/db/schema';
import { useCaregiverStore } from '@/stores/caregiverStore';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTranslation } from '@/lib/i18n/provider';

const SETTINGS_FAQ = [
  {
    id: 'patient-language',
    question: 'Change patient language?',
    answer:
      'Use the Language card above. It changes what the patient sees and hears the next time they open the app — the patient never sees a language control themselves.',
  },
  {
    id: 'forgot-pin',
    question: 'Forgot my PIN?',
    answer:
      'There is no PIN reset from this screen for safety reasons. Log out and sign back in with your email to set a new PIN from a fresh caregiver login.',
  },
  {
    id: 'offline',
    question: 'Works without internet?',
    answer:
      'Yes. Games, reminders, and the Memory Bank all work offline on this device. Syncing to your other devices and the family-share links need a connection.',
  },
  {
    id: 'family-share',
    question: 'Share updates with family?',
    answer:
      'Open a patient, go to the Family tab, and create a link. It is read-only, expires after 30 days, and can be revoked any time — no login needed on their end.',
  },
];

const PIN_LENGTH = 4;
type PinChangeStage = 'current' | 'new' | 'confirm';
type DangerStage = 'closed' | 'confirmDelete' | 'confirmDeletePin';

export default function CaregiverSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const verifyPin = useSettingsStore((s) => s.verifyPin);
  const setPin = useSettingsStore((s) => s.setPin);
  const hasPin = useSettingsStore((s) => s.caregiverPinHash !== null);

  // A caregiver who skipped PIN setup at login (or is on a device that never
  // offered it) has no "current PIN" to enter — starting this flow at
  // 'current' would strand them with no way to ever set one from here.
  const [stage, setStage] = useState<PinChangeStage>(hasPin ? 'current' : 'new');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [dangerStage, setDangerStage] = useState<DangerStage>('closed');
  const [deletePin, setDeletePin] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const resetPinFlow = () => {
    setStage(hasPin ? 'current' : 'new');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setSaved(false);
  };

  const onDigit = async (digit: string) => {
    setError('');
    setSaved(false);

    if (stage === 'current') {
      const next = currentPin.length < PIN_LENGTH ? currentPin + digit : currentPin;
      setCurrentPin(next);
      if (next.length === PIN_LENGTH) {
        const ok = await verifyPin(next);
        if (ok) {
          setStage('new');
        } else {
          setError('Current PIN is incorrect');
          setCurrentPin('');
        }
      }
      return;
    }

    if (stage === 'new') {
      const next = newPin.length < PIN_LENGTH ? newPin + digit : newPin;
      setNewPin(next);
      if (next.length === PIN_LENGTH) setStage('confirm');
      return;
    }

    const next = confirmPin.length < PIN_LENGTH ? confirmPin + digit : confirmPin;
    setConfirmPin(next);
    if (next.length === PIN_LENGTH) {
      if (next !== newPin) {
        setError('PINs do not match');
        setConfirmPin('');
        setNewPin('');
        setStage('new');
        return;
      }
      await setPin(next);
      setSaved(true);
      setStage('current');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    }
  };

  const onBackspace = () => {
    setError('');
    if (stage === 'current') setCurrentPin((p) => p.slice(0, -1));
    else if (stage === 'new') setNewPin((p) => p.slice(0, -1));
    else setConfirmPin((p) => p.slice(0, -1));
  };

  /**
   * Signs out AND clears the local caregiver/patient trust anchor — a
   * real logout, not the Supabase-only sign-out this used to be. With the
   * PIN-first local gate (see `restoreLocalSession`), signing out of
   * Supabase alone left the local Dexie profile intact, so the caregiver
   * was let straight back in on the very next PIN entry — logout did
   * nothing a caregiver could observe. Game telemetry/session tables are
   * untouched: this device's local caregiver+patient *profile* is what
   * gets cleared, not played progress, which stays queued to sync once
   * someone logs back in. A real re-login pulls the caregiver and patient
   * back down from the server — this does not require re-entering patient
   * data, only `deleteAllData` below does.
   */
  const logOut = async () => {
    await createBrowserClient().auth.signOut();
    await db.transaction('rw', db.caregivers, db.patients, db.reminderSchedules, async () => {
      await db.caregivers.clear();
      await db.patients.clear();
      await db.reminderSchedules.clear();
    });
    useCaregiverStore.getState().setCurrentCaregiver(null);
    usePatientStore.setState({ currentPatient: null, allPatients: [] });
    useSettingsStore.setState({ caregiverPinHash: null, caregiverSessionVerifiedAt: null });
    router.push('/caregiver/login');
  };

  const startDeleteAllData = () => {
    setDangerStage('confirmDelete');
    setDeleteError('');
    setDeletePin('');
  };

  const cancelDeleteAllData = () => {
    setDangerStage('closed');
    setDeleteError('');
    setDeletePin('');
  };

  const proceedToDeletePin = () => setDangerStage('confirmDeletePin');

  const onDeletePinDigit = async (digit: string) => {
    setDeleteError('');
    const next = deletePin.length < PIN_LENGTH ? deletePin + digit : deletePin;
    setDeletePin(next);
    if (next.length !== PIN_LENGTH) return;

    const ok = await verifyPin(next);
    if (!ok) {
      setDeleteError('PIN is incorrect');
      setDeletePin('');
      return;
    }
    await deleteAllData();
  };

  const onDeletePinBackspace = () => {
    setDeleteError('');
    setDeletePin((p) => p.slice(0, -1));
  };

  /**
   * Wipes this device clean: every local Dexie table, every Zustand store,
   * the PIN, and the Supabase session. This is deliberately local-only — it
   * does not delete anything from the caregiver's Supabase account, only
   * from this device. Onboarding is the only way back in afterward, which
   * is the point: this is the one action allowed to require re-entering
   * patient data from scratch.
   */
  const deleteAllData = async () => {
    setDeleting(true);
    try {
      await createBrowserClient().auth.signOut().catch(() => {});
      // Not db.close() first: this `db` singleton keeps living for the rest
      // of the SPA session (router.push below is a client-side transition,
      // not a full reload) — an explicit close() marks it permanently closed
      // and every other query anywhere in the app would start throwing
      // DatabaseClosedError. Dexie.delete() closes what it needs to on its
      // own and the singleton reopens lazily against the fresh empty
      // database on its next query, same as it does on first ever use.
      await SmritiDB.deleteDatabase();
      useCaregiverStore.getState().setCurrentCaregiver(null);
      usePatientStore.setState(usePatientStore.getInitialState(), true);
      useSettingsStore.setState(useSettingsStore.getInitialState(), true);
      if (typeof window !== 'undefined') window.localStorage.removeItem('smriti.settings');
      router.push('/caregiver/login');
    } finally {
      setDeleting(false);
    }
  };

  const stageLabel = {
    current: 'Enter current PIN',
    new: 'Enter new PIN',
    confirm: 'Confirm new PIN',
  }[stage];

  return (
    <main className="mx-auto max-w-dashboard px-4 py-6 md:px-8 md:py-10">
      <header className="mb-8 border-b-2 border-muga/30 pb-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-muga-dark">Caregiver</p>
        <h1 className="font-serif-display text-caregiver-heading font-semibold text-navy">
          Settings
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="overflow-hidden rounded-card border border-line200 bg-white">
          <div className="flex flex-col gap-3 p-6">
            <h2 className="font-serif-display text-lg font-semibold text-navy">Language</h2>
            <LanguagePicker />
          </div>
        </section>

        {dangerStage === 'closed' ? (
          <section className="overflow-hidden rounded-card border border-line200 bg-white">
            <div className="flex flex-col gap-3 p-6">
              <h2 className="font-serif-display text-lg font-semibold text-navy">Change PIN</h2>
              <p className="text-caregiver-body text-ink-muted">{stageLabel}</p>
              <PinPad onDigit={onDigit} onBackspace={onBackspace} />
              {error ? <p className="text-caregiver-body text-warning">{error}</p> : null}
              {saved ? <p className="text-caregiver-body font-bold text-success">PIN updated</p> : null}
              <BigButton label="Cancel" variant="secondary" onClick={resetPinFlow} />
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-card border border-line200 bg-white md:col-span-2">
          <div className="flex flex-col gap-2 p-6 text-caregiver-body text-ink-muted">
            <h2 className="font-serif-display text-lg font-semibold text-navy">About SMRITI</h2>
            <p>Version 1.0.0-hackathon</p>
            <p>Built for Smart India Hackathon 2026 (SIH26003)</p>
            <p>Supported by the Ministry of Development of North Eastern Region (MDoNER)</p>
            <p>{t('disclaimer')}</p>
          </div>
        </section>

        <div className="md:col-span-2">
          <FaqTabsCard title="Help & FAQ" items={SETTINGS_FAQ} />
        </div>

        <section className="overflow-hidden rounded-card border-2 border-danger/40 bg-white md:col-span-2">
          <div className="flex flex-col gap-3 p-6">
            <h2 className="font-serif-display text-lg font-semibold text-danger">Danger Zone</h2>

            {dangerStage === 'closed' ? (
              <>
                <p className="text-caregiver-body text-ink-muted">
                  Permanently erases everything on this device: your profile and every patient&apos;s
                  data. This cannot be undone, and you will need to set up SMRITI again from scratch
                  afterward.
                </p>
                <BigButton
                  label="Delete all data"
                  variant="secondary"
                  onClick={startDeleteAllData}
                />
              </>
            ) : null}

            {dangerStage === 'confirmDelete' ? (
              <>
                <p className="text-caregiver-body font-bold text-danger">
                  Are you sure? This permanently deletes this device&apos;s caregiver profile and every
                  patient&apos;s data, including game history. It cannot be undone.
                </p>
                <BigButton label="Cancel" variant="secondary" onClick={cancelDeleteAllData} />
                <BigButton
                  label="Yes, delete everything"
                  variant="secondary"
                  onClick={proceedToDeletePin}
                />
              </>
            ) : null}

            {dangerStage === 'confirmDeletePin' ? (
              <>
                <p className="text-caregiver-body text-ink-muted">
                  Enter your PIN to confirm deletion
                </p>
                <PinPad onDigit={onDeletePinDigit} onBackspace={onDeletePinBackspace} disabled={deleting} />
                {deleteError ? (
                  <p className="text-caregiver-body text-warning">{deleteError}</p>
                ) : null}
                <BigButton label="Cancel" variant="secondary" onClick={cancelDeleteAllData} disabled={deleting} />
              </>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-6">
        <BigButton label="Log out" variant="secondary" onClick={logOut} />
      </div>
    </main>
  );
}
