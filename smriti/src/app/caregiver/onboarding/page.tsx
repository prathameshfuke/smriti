'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import BigButton from '@/components/ui/BigButton';
import ConsentForm from '@/components/caregiver/ConsentForm';
import LanguagePicker from '@/components/layout/LanguagePicker';
import PinPad from '@/components/ui/PinPad';
import PinDots from '@/components/ui/PinDots';
import { fieldClass, labelClass } from '@/components/ui/Panel';
import { db, type LocalCaregiver, type LocalPatient } from '@/lib/db/schema';
import { useCaregiverStore } from '@/stores/caregiverStore';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { setDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { pushCaregiverProfile } from '@/lib/db/serverProfile';
import { buildStarterReminders } from '@/lib/patients/starterReminders';
import { EMPTY_CONSENT_CHOICES, hasRequiredChoices, type ConsentChoices } from '@/lib/consent/policy';
import { pushConsent, saveConsent } from '@/lib/consent/consentClient';
import type { CaregiverRole, Gender } from '@/lib/supabase/types';

const STEPS = [1, 2, 3, 4, 5] as const;
const PIN_LENGTH = 4;

const ROLES: { value: CaregiverRole; label: string }[] = [
  { value: 'family', label: 'Family Member' },
  { value: 'asha_worker', label: 'ASHA Worker' },
  { value: 'nurse', label: 'Nurse / Healthcare' },
  { value: 'clinician', label: 'Doctor' },
];

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const DURATIONS = [10, 15, 20] as const;

interface WizardData {
  caregiverName: string;
  role: CaregiverRole | null;
  patientName: string;
  ageYears: string;
  gender: Gender | null;
  educationYears: string;
  sessionDurationMinutes: (typeof DURATIONS)[number] | null;
  pin: string;
  confirmPin: string;
  addMorningReminder: boolean;
  addHydrationReminders: boolean;
  deviceTrusted: boolean;
  consent: ConsentChoices;
}

const initialData: WizardData = {
  caregiverName: '',
  role: null,
  patientName: '',
  ageYears: '',
  gender: null,
  educationYears: '',
  sessionDurationMinutes: null,
  pin: '',
  confirmPin: '',
  addMorningReminder: false,
  addHydrationReminders: false,
  deviceTrusted: false,
  consent: EMPTY_CONSENT_CHOICES,
};

/** Where the caregiver is in setup, in words and as four segments. */
function StepDots({ step }: { step: number }) {
  return (
    <div aria-label={`Step ${step} of ${STEPS.length}`} role="group">
      <p aria-hidden="true" className="text-caregiver-body font-bold text-ink-muted">
        Step {step} of {STEPS.length}
      </p>
      <div aria-hidden="true" className="mt-2 grid grid-cols-5 gap-1.5">
        {STEPS.map((s) => (
          <span
            key={s}
            className={`h-1.5 rounded-full transition-colors duration-300 ${s <= step ? 'bg-primary' : 'bg-line200'}`}
          />
        ))}
      </div>
    </div>
  );
}

const stepHeading = 'font-serif-display text-[2.25rem] font-medium leading-[1.1] text-ink';
const groupLabel = 'mb-3 block text-caregiver-body font-bold text-ink';

export default function CaregiverOnboardingPage() {
  const router = useRouter();
  const createCaregiver = useCaregiverStore((s) => s.createCaregiver);
  const addPatient = usePatientStore((s) => s.addPatient);
  const setPin = useSettingsStore((s) => s.setPin);
  const language = useSettingsStore((s) => s.language);

  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);
  const [pinError, setPinError] = useState('');
  const [trustLoading, setTrustLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Guardrail: nothing about the caregiver or patient is even asked for until
  // both required agreements are given (step 1), and finish() re-checks it.
  const canContinueConsent = hasRequiredChoices(data.consent);
  const canContinueStep1 = data.caregiverName.trim().length > 0 && data.role !== null;
  const canContinueStep2 =
    data.patientName.trim().length > 0 &&
    data.gender !== null &&
    data.sessionDurationMinutes !== null &&
    Number(data.ageYears) >= 40 &&
    Number(data.ageYears) <= 120;

  const enterPinDigit = (field: 'pin' | 'confirmPin', digit: string) => {
    setPinError('');
    setData((d) => {
      const current = d[field];
      if (current.length >= PIN_LENGTH) return d;
      return { ...d, [field]: current + digit };
    });
  };

  const backspacePin = (field: 'pin' | 'confirmPin') => {
    setPinError('');
    setData((d) => ({ ...d, [field]: d[field].slice(0, -1) }));
  };

  const setupDatabase = async () => {
    if (!hasRequiredChoices(data.consent)) {
      setStep(1);
      return false;
    }
    if (data.pin.length !== PIN_LENGTH || data.pin !== data.confirmPin) {
      setPinError('PINs do not match');
      return false;
    }

    const caregiverId = uuid();
    const patientId = uuid();
    const now = new Date().toISOString();

    // Ties the local profile to the real Supabase account so a later
    // real login (magic link) can find it again — a generated id here
    // would silently orphan this caregiver from their own dashboard.
    // getSession() reads the already-established local session, not a
    // network round trip like getUser() — offline onboarding must not
    // hang here waiting on a request that may never resolve.
    let authUserId = caregiverId;
    if (isSupabaseConfigured()) {
      const { data: sessionData } = await createBrowserClient().auth.getSession();
      if (sessionData.session?.user) authUserId = sessionData.session.user.id;
    }

    const caregiver: LocalCaregiver = {
      id: caregiverId,
      authUserId,
      displayName: data.caregiverName,
      role: data.role as CaregiverRole,
      createdAt: now,
    };
    await createCaregiver(caregiver);

    const patient: LocalPatient = {
      id: patientId,
      caregiverId,
      displayName: data.patientName,
      ageYears: Number(data.ageYears),
      gender: data.gender as Gender,
      educationYears: Number(data.educationYears) || 0,
      primaryLanguage: language,
      sessionDurationMinutes: data.sessionDurationMinutes ?? 10,
      isActive: true,
      currentDifficulty: {},
      updatedAt: now,
      syncedAt: null,
    };
    await addPatient(patient);
    const consent = await saveConsent(patientId, caregiverId, data.consent, { push: false });
    usePatientStore.getState().setCurrentPatient(patient);

    await setPin(data.pin);
    useSettingsStore.getState().markCaregiverSessionVerified();

    const reminders = buildStarterReminders(patientId, {
      morningMedication: data.addMorningReminder,
      hydration: data.addHydrationReminders,
    });
    if (reminders.length > 0) await db.reminderSchedules.bulkPut(reminders);

    // Best-effort: mirrors the profile to Supabase so the dashboard's
    // `/api/patients` call and any other device can find this caregiver
    // instead of forcing onboarding again. Never blocks or fails setup —
    // an offline caregiver still gets a fully working local device.
    if (isSupabaseConfigured()) {
      // Awaited when online so the "Trust this device" step that follows can
      // find the patient on the account; offline setup still completes
      // locally and syncs the profile later.
      // The consent row references the patient, so it goes up after the profile.
      if (typeof navigator === 'undefined' || navigator.onLine) {
        if (await pushCaregiverProfile(caregiver, patient, language, reminders)) await pushConsent(consent);
      } else {
        void pushCaregiverProfile(caregiver, patient, language, reminders);
      }
    }

    return { caregiverId, patientId };
  };

  const trustDevice = async (patientId: string) => {
    setTrustLoading(true);
    try {
      await setDeviceTrustToken(patientId);
      setData((d) => ({ ...d, deviceTrusted: true }));
    } catch (err) {
      console.error('Failed to set device trust token:', err);
    } finally {
      setTrustLoading(false);
      setStep(5);
    }
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    setPinError('');
    try {
      const result = await setupDatabase();
      if (result) {
        await trustDevice(result.patientId);
      }
    } catch (err) {
      console.error('Onboarding setup failed:', err);
      setPinError('Something went wrong finishing setup. Please try again.');
    } finally {
      setFinishing(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 bg-canvas px-5 py-8">
      <StepDots step={step} />

      {step === 1 ? (
        <section className="flex flex-col gap-5">
          <h1 className={stepHeading}>Privacy &amp; consent</h1>
          <p className="-mt-2 text-caregiver-body text-ink-muted">
            Before setting up, read what SMRITI stores about you and the person you care for, who it is shared
            with, and how it is protected.
          </p>
          <ConsentForm choices={data.consent} onChange={(consent) => setData((d) => ({ ...d, consent }))} />
          <BigButton
            label="Agree and continue"
            variant="primary"
            disabled={!canContinueConsent}
            onClick={() => setStep(2)}
          />
        </section>
      ) : null}

      {step === 2 ? (
        <section className="flex flex-col gap-5">
          <h1 className={stepHeading}>About you</h1>
          <div>
            <label htmlFor="caregiver-name" className={labelClass}>
              Your name
            </label>
            <input
              id="caregiver-name"
              value={data.caregiverName}
              onChange={(e) => setData((d) => ({ ...d, caregiverName: e.target.value }))}
              placeholder="Your name"
              autoComplete="name"
              className={fieldClass}
            />
          </div>
          <p className={groupLabel}>Your role</p>
          <div className="-mt-1 flex flex-col gap-3">
            {ROLES.map((r) => (
              <BigButton
                key={r.value}
                label={r.label}
                variant={data.role === r.value ? 'primary' : 'secondary'}
                onClick={() => setData((d) => ({ ...d, role: r.value }))}
              />
            ))}
          </div>
          <BigButton
            label="Continue"
            variant="primary"
            disabled={!canContinueStep1}
            onClick={() => setStep(3)}
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="flex flex-col gap-5">
          <h1 className={stepHeading}>Your patient</h1>
          <div>
            <label htmlFor="patient-name" className={labelClass}>
              Patient name
            </label>
            <input
              id="patient-name"
              value={data.patientName}
              onChange={(e) => setData((d) => ({ ...d, patientName: e.target.value }))}
              placeholder="Patient name"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="patient-age" className={labelClass}>
              Age
            </label>
            <input
              id="patient-age"
              type="number"
              inputMode="numeric"
              min={40}
              max={120}
              value={data.ageYears}
              onChange={(e) => setData((d) => ({ ...d, ageYears: e.target.value }))}
              placeholder="Age"
              className={fieldClass}
            />
          </div>
          <p className={groupLabel}>Gender</p>
          <div className="-mt-1 flex flex-col gap-3 sm:flex-row">
            {GENDERS.map((g) => (
              <div key={g.value} className="flex-1">
                <BigButton
                  label={g.label}
                  variant={data.gender === g.value ? 'primary' : 'secondary'}
                  onClick={() => setData((d) => ({ ...d, gender: g.value }))}
                />
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="patient-education" className={labelClass}>
              Years of education
            </label>
            <input
              id="patient-education"
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              value={data.educationYears}
              onChange={(e) => setData((d) => ({ ...d, educationYears: e.target.value }))}
              placeholder="Years of education"
              className={fieldClass}
            />
          </div>
          <p className={groupLabel}>Patient&apos;s language</p>
          <div className="-mt-1">
            <LanguagePicker />
          </div>
          <p className={groupLabel}>Session length</p>
          <div className="-mt-1 flex gap-3">
            {DURATIONS.map((mins) => (
              <div key={mins} className="flex-1">
                <BigButton
                  label={`${mins} min`}
                  variant={data.sessionDurationMinutes === mins ? 'primary' : 'secondary'}
                  onClick={() => setData((d) => ({ ...d, sessionDurationMinutes: mins }))}
                />
              </div>
            ))}
          </div>
          <BigButton
            label="Continue"
            variant="primary"
            disabled={!canContinueStep2}
            onClick={() => setStep(4)}
          />
        </section>
      ) : null}

      {step === 4 ? (
        <section className="flex flex-col gap-5">
          <h1 className={stepHeading}>Caregiver PIN</h1>
          <p className="-mt-2 text-caregiver-body text-ink-muted">
            Create a 4-digit PIN to access the caregiver area
          </p>

          <div className="flex items-center justify-between gap-4">
            <p className="text-caregiver-body font-bold text-ink">New PIN</p>
            <PinDots filled={data.pin.length} length={PIN_LENGTH} />
          </div>
          <PinPad
            onDigit={(d) => enterPinDigit('pin', d)}
            onBackspace={() => backspacePin('pin')}
          />

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-line200 pt-6">
            <p className="text-caregiver-body font-bold text-ink">Confirm PIN</p>
            <PinDots filled={data.confirmPin.length} length={PIN_LENGTH} />
          </div>
          <PinPad
            onDigit={(d) => enterPinDigit('confirmPin', d)}
            onBackspace={() => backspacePin('confirmPin')}
          />

          {pinError ? (
            <p role="alert" className="text-caregiver-body font-bold text-danger">
              {pinError}
            </p>
          ) : null}

          <p className={`${groupLabel} mt-4 border-t border-line200 pt-6`}>Starter reminders (optional)</p>
          <BigButton
            label="Add morning medication reminder"
            variant={data.addMorningReminder ? 'primary' : 'secondary'}
            onClick={() => setData((d) => ({ ...d, addMorningReminder: !d.addMorningReminder }))}
          />
          <BigButton
            label="Add hydration reminders"
            variant={data.addHydrationReminders ? 'primary' : 'secondary'}
            onClick={() =>
              setData((d) => ({ ...d, addHydrationReminders: !d.addHydrationReminders }))
            }
          />

          <BigButton
            label={finishing ? 'Setting up…' : 'Finish setup'}
            variant="success"
            onClick={finish}
            disabled={finishing}
          />
        </section>
      ) : null}

      {step === 5 ? (
        <section className="flex flex-col gap-5">
          <h1 className={stepHeading}>Trust this device</h1>
          <p className="text-caregiver-body text-ink">
            This device is now set up for <strong>{data.patientName}</strong>.
          </p>
          <div className="rounded-card border border-line200 bg-surface-card p-5">
            <p className="text-caregiver-body text-ink">
              You can now hand this device to the patient. They can open SMRITI anytime without entering any code.
            </p>
            <p className="mt-3 text-caregiver-body text-ink-muted">
              To come back to the caregiver area, tap Caregiver at the top of the patient home screen.
            </p>
          </div>
          <BigButton
            label="Done"
            variant="success"
            onClick={() => router.push('/app')}
            disabled={trustLoading}
          />
        </section>
      ) : null}
    </main>
  );
}
