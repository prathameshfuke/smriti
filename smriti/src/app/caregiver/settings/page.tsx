'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDevicePatients } from '@/lib/auth/localSession';
import { buildQueueItem } from '@/lib/db/syncQueue';
import type { UILanguage } from '@/lib/i18n/languages';
import { useRouter } from 'next/navigation';
import LanguagePicker from '@/components/layout/LanguagePicker';
import DisplaySizeSettings from '@/components/caregiver/DisplaySizeSettings';
import FaqTabsCard from '@/components/ui/FaqTabsCard';
import PinPad from '@/components/ui/PinPad';
import PinDots from '@/components/ui/PinDots';
import PageHeader from '@/components/ui/PageHeader';
import Panel, { buttonClass } from '@/components/ui/Panel';
import { createBrowserClient } from '@/lib/supabase/client';
import { db, SmritiDB } from '@/lib/db/schema';
import { syncAllPatients } from '@/lib/db/sync';
import { useCaregiverStore } from '@/stores/caregiverStore';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTranslation } from '@/lib/i18n/provider';

const SETTINGS_FAQ = [
  {
    id: 'patient-language',
    question: 'Change patient language?',
    answer:
      'Use Patient language on this page. It changes what the patient sees and hears the next time they open the app. The patient never sees a language control themselves.',
  },
  {
    id: 'forgot-pin',
    question: 'Forgot my PIN?',
    answer:
      'There is no PIN reset from this screen for safety reasons. Log out and sign back in with your email — after verifying, you can choose to set a new PIN instead of continuing with the old one.',
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
      'Open a patient, go to the Family tab, and create a link. It is read-only, expires after 30 days, and can be revoked any time. No login is needed on their end.',
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

  const currentPatient = usePatientStore((s) => s.currentPatient);
  const [devicePatientSummary, setDevicePatientSummary] = useState('Checking…');

  useEffect(() => {
    let cancelled = false;
    void getDevicePatients().then((patients) => {
      if (cancelled) return;
      setDevicePatientSummary(
        patients.length === 0
          ? 'Nobody is chosen for this phone yet.'
          : patients.length === 1
            ? `${patients[0].displayName} uses this phone.`
            : `Shared by ${patients.map((p) => p.displayName).join(' and ')}.`,
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** The language belongs to the patient: on a shared phone it switches with
   * whoever is playing, so a change here is saved on them too. */
  const saveLanguageForPatient = async (code: UILanguage) => {
    if (!currentPatient) return;
    const updated = { ...currentPatient, primaryLanguage: code, updatedAt: new Date().toISOString() };
    await db.transaction('rw', db.patients, db.syncQueue, async () => {
      await db.patients.put(updated);
      await db.syncQueue.put(buildQueueItem('patients', updated.id, 'update', { ...updated }));
    });
    usePatientStore.getState().setCurrentPatient(updated);
  };

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
   * untouched: this device's local caregiver+patient *profile* (plus the
   * private caches listed below) is what gets cleared, not played progress,
   * which stays queued to sync once someone logs back in. A real re-login pulls the caregiver and patient
   * back down from the server — this does not require re-entering patient
   * data, only `deleteAllData` below does.
   *
   * The PIN itself is deliberately left alone: it's a device-level quick
   * unlock, not part of "this login's" state, and clearing it here forced
   * the same caregiver to redo PIN setup on every ordinary logout (#15).
   * `clearPinIfDifferentCaregiver` (called from `pullAndStoreServerProfile`
   * on the next real login) still wipes it the moment a *different*
   * caregiver signs in on this device, so nobody inherits a stranger's PIN.
   * `caregiverSessionVerifiedAt` still resets — a real sign-out happened,
   * so the PIN's freshness check must not treat this session as still live.
   */
  const logOut = async () => {
    // Best-effort flush so this device's currentDifficulty/progress reaches
    // the server before the local copy is wiped below — otherwise the next
    // login's server pull has nothing but a stale currentDifficulty to hand
    // back, and the caregiver sees the patient's level reset (#19). Must run
    // BEFORE signOut(): syncAllPatients() needs the still-live session to
    // authenticate the request, and signOut() clears it.
    await syncAllPatients().catch(() => {});
    await createBrowserClient().auth.signOut();
    // Also the private caches that can't be synced but aren't progress either:
    // companion Q&A, pulled family messages and generated quizzes. The next
    // caregiver to sign in on this device must not see them; the server
    // copies come back on the next pull, and quizzes are regenerated.
    // Memory Bank entries, photos and telemetry stay: they can hold edits not
    // synced yet, they are only ever read for the signed-in patient, and they
    // are encrypted at rest (lib/db/crypto/fields.ts).
    await db.transaction(
      'rw',
      [db.caregivers, db.patients, db.reminderSchedules, db.aiConversationLog, db.familyMessages, db.reminiscenceQuizzes],
      async () => {
        await db.caregivers.clear();
        await db.patients.clear();
        await db.reminderSchedules.clear();
        await db.aiConversationLog.clear();
        await db.familyMessages.clear();
        await db.reminiscenceQuizzes.clear();
      },
    );
    useCaregiverStore.getState().setCurrentCaregiver(null);
    usePatientStore.setState({ currentPatient: null, allPatients: [] });
    useSettingsStore.setState({ caregiverSessionVerifiedAt: null });
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

  const stageDigits = stage === 'current' ? currentPin : stage === 'new' ? newPin : confirmPin;

  return (
    <main className="mx-auto w-full max-w-dashboard px-5 py-8 md:px-10 md:py-12">
      <PageHeader title="Settings" description="Language, text size, PIN and data for this device." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <Panel
          title={currentPatient ? `Language for ${currentPatient.displayName}` : 'Patient language'}
          description="What they see and hear in SMRITI."
        >
          <LanguagePicker onSelect={(code) => void saveLanguageForPatient(code)} />
        </Panel>

        <Panel
          title="Text and icon size"
          description="Make words and pictures bigger on every screen of this phone."
        >
          <DisplaySizeSettings />
        </Panel>

        <Panel
          title="People on this phone"
          description="Choose who plays SMRITI here. A phone shared by two people asks who is playing when opened."
        >
          <p className="text-caregiver-body text-ink">{devicePatientSummary}</p>
          <Link href="/caregiver/device" className={`${buttonClass.secondary} mt-4 w-full sm:w-auto`}>
            Manage people on this phone
          </Link>
        </Panel>

        {dangerStage === 'closed' ? (
          <Panel title="Change PIN" description="The 4-digit PIN opens the caregiver area from the patient's screen.">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-caregiver-body font-bold text-ink">{stageLabel}</p>
                <PinDots filled={stageDigits.length} length={PIN_LENGTH} />
              </div>
              <PinPad onDigit={onDigit} onBackspace={onBackspace} />
              <div role="status" className="empty:hidden">
                {error ? <p className="text-caregiver-body font-bold text-danger">{error}</p> : null}
                {saved ? <p className="text-caregiver-body font-bold text-ink">PIN updated</p> : null}
              </div>
              <button type="button" onClick={resetPinFlow} className={buttonClass.secondary}>
                Cancel
              </button>
            </div>
          </Panel>
        ) : null}

        <div className="lg:col-span-2">
          <FaqTabsCard title="Help & FAQ" items={SETTINGS_FAQ} />
        </div>

        <Panel title="Account">
          <p className="text-caregiver-body text-ink-muted">
            Log out of the caregiver area on this device. Game progress stays saved and syncs after the next login.
          </p>
          <button type="button" onClick={logOut} className={`${buttonClass.secondary} mt-4`}>
            Log out
          </button>
        </Panel>

        <Panel title="About SMRITI">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-caregiver-body [&_dd]:[overflow-wrap:anywhere]">
            <dt className="text-ink-muted">Version</dt>
            <dd className="text-ink">1.0.0-hackathon</dd>
            <dt className="text-ink-muted">Built for</dt>
            <dd className="text-ink">Smart India Hackathon 2026 (SIH26003)</dd>
            <dt className="text-ink-muted">Supported by</dt>
            <dd className="text-ink">Ministry of Development of North Eastern Region (MDoNER)</dd>
          </dl>
          <p className="mt-4 text-patient-sm text-ink-muted">{t('disclaimer')}</p>
        </Panel>

        <section
          aria-labelledby="delete-data-heading"
          className="rounded-card border-2 border-danger/40 bg-surface-card p-5 lg:col-span-2"
        >
          <h2 id="delete-data-heading" className="font-serif-display text-[1.375rem] font-medium leading-tight text-ink">
            Delete all data on this device
          </h2>

          {dangerStage === 'closed' ? (
            <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
              <p className="max-w-[65ch] text-caregiver-body text-ink-muted">
                Permanently erases everything on this device: your profile and every patient&apos;s data. This cannot
                be undone, and you will need to set up SMRITI again from scratch afterward.
              </p>
              <button
                type="button"
                onClick={startDeleteAllData}
                className={`${buttonClass.secondary} shrink-0 border-danger text-danger hover:bg-danger/5`}
              >
                Delete all data
              </button>
            </div>
          ) : null}

          {dangerStage === 'confirmDelete' ? (
            <div className="mt-2 flex flex-col gap-4">
              <p role="alert" className="max-w-[65ch] text-caregiver-body font-bold text-ink">
                Are you sure? This permanently deletes this device&apos;s caregiver profile and every patient&apos;s
                data, including game history. It cannot be undone.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={cancelDeleteAllData} className={buttonClass.secondary}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={proceedToDeletePin}
                  className={`${buttonClass.primary} bg-danger hover:bg-danger`}
                >
                  Yes, delete everything
                </button>
              </div>
            </div>
          ) : null}

          {dangerStage === 'confirmDeletePin' ? (
            <div className="mt-2 flex max-w-sm flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-caregiver-body font-bold text-ink">Enter your PIN to confirm deletion</p>
                <PinDots filled={deletePin.length} length={PIN_LENGTH} />
              </div>
              <PinPad onDigit={onDeletePinDigit} onBackspace={onDeletePinBackspace} disabled={deleting} />
              <div role="status" className="empty:hidden">
                {deleteError ? <p className="text-caregiver-body font-bold text-danger">{deleteError}</p> : null}
              </div>
              <button type="button" onClick={cancelDeleteAllData} disabled={deleting} className={buttonClass.secondary}>
                Cancel
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
