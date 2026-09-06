'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import BigButton from '@/components/ui/BigButton';
import LanguagePicker from '@/components/layout/LanguagePicker';
import PinPad from '@/components/ui/PinPad';
import { db, type LocalCaregiver, type LocalPatient, type LocalReminderSchedule } from '@/lib/db/schema';
import { useCaregiverStore } from '@/stores/caregiverStore';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { setDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { pushCaregiverProfile } from '@/lib/db/serverProfile';
import type { CaregiverRole, Gender } from '@/lib/supabase/types';

const STEPS = [1, 2, 3, 4] as const;
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
};

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex justify-center gap-2" aria-label={`Step ${step} of 3`}>
      {STEPS.map((s) => (
        <span
          key={s}
          className={`h-3 w-3 rounded-full transition-colors duration-300 ${
            s <= step ? 'bg-muga' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function buildReminders(patientId: string, data: WizardData): LocalReminderSchedule[] {
  const now = new Date().toISOString();
  const reminders: LocalReminderSchedule[] = [];

  if (data.addMorningReminder) {
    reminders.push({
      id: uuid(),
      patientId,
      reminderType: 'medication',
      label: 'Morning medication',
      timeOfDay: '08:00',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      isActive: true,
      updatedAt: now,
    });
  }

  if (data.addHydrationReminders) {
    for (let hour = 8; hour <= 20; hour += 2) {
      reminders.push({
        id: uuid(),
        patientId,
        reminderType: 'hydration',
        label: 'Drink water',
        timeOfDay: `${String(hour).padStart(2, '0')}:00`,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        isActive: true,
        updatedAt: now,
      });
    }
  }

  return reminders;
}

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
    usePatientStore.getState().setCurrentPatient(patient);

    await setPin(data.pin);

    const reminders = buildReminders(patientId, data);
    if (reminders.length > 0) await db.reminderSchedules.bulkPut(reminders);

    // Best-effort: mirrors the profile to Supabase so the dashboard's
    // `/api/patients` call and any other device can find this caregiver
    // instead of forcing onboarding again. Never blocks or fails setup —
    // an offline caregiver still gets a fully working local device.
    if (isSupabaseConfigured()) {
      void pushCaregiverProfile(caregiver, patient, language, reminders);
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
      setStep(4);
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
    <main className="mx-auto flex min-h-dvh max-w-patient flex-col gap-6 bg-canvas px-4 py-6">
      <StepDots step={step} />

      {step === 1 ? (
        <section className="flex flex-col gap-4">
          <h1 className="text-center font-serif-display text-caregiver-heading font-semibold text-ink">
            About you
          </h1>
          <label htmlFor="caregiver-name" className="sr-only">
            Your name
          </label>
          <input
            id="caregiver-name"
            value={data.caregiverName}
            onChange={(e) => setData((d) => ({ ...d, caregiverName: e.target.value }))}
            placeholder="Your name"
            className="h-14 w-full rounded-card border border-gray-200 px-4 text-caregiver-body text-ink shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-caregiver-body text-ink">Your role</p>
          <div className="flex flex-col gap-3">
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
            onClick={() => setStep(2)}
          />
        </section>
      ) : null}

      {step === 2 ? (
        <section className="flex flex-col gap-4">
          <h1 className="text-center font-serif-display text-caregiver-heading font-semibold text-ink">
            Your patient
          </h1>
          <label htmlFor="patient-name" className="sr-only">
            Patient name
          </label>
          <input
            id="patient-name"
            value={data.patientName}
            onChange={(e) => setData((d) => ({ ...d, patientName: e.target.value }))}
            placeholder="Patient name"
            className="h-14 w-full rounded-card border border-gray-200 px-4 text-caregiver-body text-ink shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <label htmlFor="patient-age" className="sr-only">
            Age
          </label>
          <input
            id="patient-age"
            type="number"
            min={40}
            max={120}
            value={data.ageYears}
            onChange={(e) => setData((d) => ({ ...d, ageYears: e.target.value }))}
            placeholder="Age"
            className="h-14 w-full rounded-card border border-gray-200 px-4 text-caregiver-body text-ink shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex gap-3">
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
          <label htmlFor="patient-education" className="sr-only">
            Years of education
          </label>
          <input
            id="patient-education"
            type="number"
            min={0}
            max={20}
            value={data.educationYears}
            onChange={(e) => setData((d) => ({ ...d, educationYears: e.target.value }))}
            placeholder="Years of education"
            className="h-14 w-full rounded-card border border-gray-200 px-4 text-caregiver-body text-ink shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-caregiver-body text-ink">Patient&apos;s language</p>
          <LanguagePicker />
          <p className="text-caregiver-body text-ink">Session duration</p>
          <div className="flex gap-3">
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
            onClick={() => setStep(3)}
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="flex flex-col gap-4">
          <h1 className="text-center font-serif-display text-caregiver-heading font-semibold text-ink">
            Setup
          </h1>
          <p className="text-center text-caregiver-body text-ink">
            Create a 4-digit PIN to access the caregiver area
          </p>

          <div className="flex justify-center gap-3" aria-hidden="true">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={`h-14 w-14 rounded-card border-2 transition-colors duration-200 ${
                  i < data.pin.length ? 'border-primary bg-primary' : 'border-gray-200'
                }`}
              />
            ))}
          </div>
          <PinPad
            onDigit={(d) => enterPinDigit('pin', d)}
            onBackspace={() => backspacePin('pin')}
          />

          <p className="text-center text-caregiver-body text-ink">Confirm PIN</p>
          <div className="flex justify-center gap-3" aria-hidden="true">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={`h-14 w-14 rounded-card border-2 transition-colors duration-200 ${
                  i < data.confirmPin.length ? 'border-primary bg-primary' : 'border-gray-200'
                }`}
              />
            ))}
          </div>
          <PinPad
            onDigit={(d) => enterPinDigit('confirmPin', d)}
            onBackspace={() => backspacePin('confirmPin')}
          />

          {pinError ? <p className="text-center text-caregiver-body text-warning">{pinError}</p> : null}

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
            label={finishing ? 'Setting up…' : 'Finish Setup'}
            variant="success"
            onClick={finish}
            disabled={finishing}
          />
        </section>
      ) : null}

      {step === 4 ? (
        <section className="flex flex-col gap-4">
          <h1 className="text-center font-serif-display text-caregiver-heading font-semibold text-ink">
            Trust this device
          </h1>
          <p className="text-center text-caregiver-body text-ink">
            This device is now set up for <strong>{data.patientName}</strong>.
          </p>
          <div className="mt-6 p-6 rounded-card bg-primary/10 border border-primary/30">
            <p className="text-center text-caregiver-body text-ink">
              You can now hand this device to the patient. They can open SMRITI anytime without entering any code.
            </p>
          </div>
          <p className="text-center text-sm text-ink/70 mt-4">
            When you need to check the caregiver dashboard, tap the icon in the corner of the patient home screen.
          </p>
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
