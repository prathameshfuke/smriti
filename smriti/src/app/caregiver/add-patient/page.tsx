'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import BigButton from '@/components/ui/BigButton';
import PageHeader from '@/components/ui/PageHeader';
import { buttonClass, fieldClass, labelClass, textActionClass } from '@/components/ui/Panel';
import { db, type LocalPatient } from '@/lib/db/schema';
import { getTrustedPatientIds, setDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { pushCaregiverProfile } from '@/lib/db/serverProfile';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { LANGUAGES, NATIVE_LANGUAGE_NAME, type UILanguage } from '@/lib/i18n/languages';
import { buildStarterReminders } from '@/lib/patients/starterReminders';
import { PhotoTooLargeError, savePatientPhoto } from '@/lib/patients/photos';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Gender } from '@/lib/supabase/types';

type Where = 'own' | 'shared';
type Step = 'where' | 'details' | 'done';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];
const DURATIONS = [10, 15, 20] as const;

const choiceClass = (selected: boolean) =>
  'min-h-14 rounded-control px-3 text-caregiver-body font-bold transition-colors ' +
  (selected ? 'bg-primary text-ink-inverse' : 'border-2 border-ink-muted/60 bg-surface-card text-ink hover:bg-surface-muted');

interface SharedPhoneResult {
  error: string | null;
  warning: string | null;
}

/**
 * Everything specific to "On this phone, shared", once the new patient is
 * already saved to the account: link the phone's existing patient first (if
 * it was never linked — a phone set up before shared phones existed), add
 * the new patient locally, save their photo, and link the phone to them too.
 * Pulled out of `save()` so that function reads as one flow instead of two.
 */
async function addToSharedPhone(
  caregiverId: string,
  patient: LocalPatient,
  reminders: ReturnType<typeof buildStarterReminders>,
  photo: File | null,
): Promise<SharedPhoneResult> {
  // If this phone was set up before shared phones existed, its current
  // patient has no per-patient link yet; link them first so adding a second
  // person never hides the first.
  const alreadyLinked = await getTrustedPatientIds();
  const existing = await db.patients
    .where('caregiverId')
    .equals(caregiverId)
    .filter((p) => p.isActive)
    .toArray();
  const implicitExisting = existing.length === 1 && !alreadyLinked.includes(existing[0].id) ? existing[0] : null;

  if (implicitExisting) {
    try {
      await setDeviceTrustToken(implicitExisting.id);
    } catch {
      return {
        error: `${patient.displayName} is saved to your account, but this phone could not be prepared for sharing. Connect to the internet, then turn them on in People on this phone.`,
        warning: null,
      };
    }
  }

  await usePatientStore.getState().addPatient(patient);
  if (reminders.length) await db.reminderSchedules.bulkPut(reminders);

  let warning: string | null = null;
  if (photo) {
    try {
      await savePatientPhoto(patient.id, photo);
    } catch (err) {
      warning =
        err instanceof PhotoTooLargeError
          ? 'The photo was too large, so it was not added. You can add one from People on this phone.'
          : 'The photo could not be used. You can add one from People on this phone.';
    }
  }

  try {
    await setDeviceTrustToken(patient.id);
  } catch {
    warning = `${patient.displayName} is saved, but this phone could not be linked to them yet. Connect to the internet, then turn them on in People on this phone.`;
  }

  return { error: null, warning };
}

/**
 * Adds another patient from inside the caregiver area. First asks where they
 * will play, because that decides what happens to this phone:
 *
 * - On their own phone or tablet: the patient is saved to the account only
 *   (this phone stays as it is). Their phone then signs in with the same
 *   email and chooses them on "Who uses this phone?".
 * - On this phone, shared: the patient is saved here and to the account, and
 *   this phone is linked to them as well as whoever already uses it, so it
 *   starts asking "Who is playing?".
 */
export default function AddPatientPage() {
  const router = useRouter();
  const appLanguage = useSettingsStore((s) => s.language);

  const [step, setStep] = useState<Step>('where');
  const [where, setWhere] = useState<Where | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [language, setLanguage] = useState<UILanguage>(appLanguage);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(10);
  const [morningMedication, setMorningMedication] = useState(false);
  const [hydration, setHydration] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const ageNumber = Number(age);
  const canSave = name.trim().length > 0 && gender !== null && ageNumber >= 40 && ageNumber <= 120;

  const save = async () => {
    if (!where || !canSave || saving) return;
    setSaving(true);
    setError(null);
    setWarning(null);

    try {
      const caregiver = await db.caregivers.toCollection().first();
      if (!caregiver) {
        setError('This phone has no caregiver profile. Sign in again, then try.');
        return;
      }

      const patient: LocalPatient = {
        id: uuid(),
        caregiverId: caregiver.id,
        displayName: name.trim(),
        ageYears: ageNumber,
        gender: gender as Gender,
        educationYears: 0,
        primaryLanguage: language,
        sessionDurationMinutes: duration,
        isActive: true,
        currentDifficulty: {},
        updatedAt: new Date().toISOString(),
        syncedAt: null,
      };
      const reminders = buildStarterReminders(patient.id, { morningMedication, hydration });
      // The caregiver's own language, not the patient's: this call also
      // upserts the caregiver row and must not change their preference.
      const caregiverLanguage = useSettingsStore.getState().language;

      const saved =
        isSupabaseConfigured() && (await pushCaregiverProfile(caregiver, patient, caregiverLanguage, reminders));
      if (!saved) {
        setError('Could not save to your account. Connect to the internet and try again.');
        return;
      }

      if (where === 'own') {
        // Nothing else is stored on this phone; the account is the only
        // place this patient lives until their own phone signs in.
        setStep('done');
        return;
      }

      const result = await addToSharedPhone(caregiver.id, patient, reminders, photo);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.warning) setWarning(result.warning);
      setStep('done');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 md:px-10 md:py-12">
      {step === 'where' ? (
        <>
          <PageHeader
            before={
              <Link href="/caregiver/patients" className={`${textActionClass} mb-2`}>
                Patients
              </Link>
            }
            title="Add a patient"
            description="Where will they play SMRITI?"
          />
          <div role="group" aria-label="Where they will play" className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setWhere('own');
                setStep('details');
              }}
              className="flex min-h-24 flex-col justify-center rounded-card border-2 border-ink-muted/60 bg-surface-card px-5 py-4 text-left transition-colors hover:border-ink-muted hover:bg-surface-muted/60"
            >
              <span className="text-patient-body font-bold text-ink">On their own phone or tablet</span>
              <span className="mt-1 text-caregiver-body text-ink-muted">
                Saved to your account. You then sign in on their device.
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setWhere('shared');
                setStep('details');
              }}
              className="flex min-h-24 flex-col justify-center rounded-card border-2 border-ink-muted/60 bg-surface-card px-5 py-4 text-left transition-colors hover:border-ink-muted hover:bg-surface-muted/60"
            >
              <span className="text-patient-body font-bold text-ink">On this phone, shared</span>
              <span className="mt-1 text-caregiver-body text-ink-muted">
                Two people at home use this phone. It will ask who is playing when opened.
              </span>
            </button>
          </div>
        </>
      ) : null}

      {step === 'details' ? (
        <>
          <PageHeader
            before={
              <button type="button" onClick={() => setStep('where')} className={`${textActionClass} mb-2`}>
                Back
              </button>
            }
            title="Their details"
            description={
              where === 'shared' ? 'They will share this phone.' : 'They will play on their own phone or tablet.'
            }
          />

          <div className="flex flex-col gap-6">
            <div>
              <label htmlFor="new-patient-name" className={labelClass}>
                Name
              </label>
              <input id="new-patient-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
            </div>

            <div>
              <label htmlFor="new-patient-age" className={labelClass}>
                Age
              </label>
              <input
                id="new-patient-age"
                type="number"
                inputMode="numeric"
                min={40}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className={fieldClass}
              />
              {age && (ageNumber < 40 || ageNumber > 120) ? (
                <p className="mt-2 text-patient-sm font-bold text-danger">Enter an age between 40 and 120.</p>
              ) : null}
            </div>

            <fieldset>
              <legend className={labelClass}>Gender</legend>
              <div className="grid grid-cols-3 gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    aria-pressed={gender === g.value}
                    onClick={() => setGender(g.value)}
                    className={choiceClass(gender === g.value)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={labelClass}>Their language</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LANGUAGES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    lang={code}
                    aria-pressed={language === code}
                    onClick={() => setLanguage(code)}
                    className={choiceClass(language === code)}
                  >
                    {NATIVE_LANGUAGE_NAME[code]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={labelClass}>Session length</legend>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    aria-pressed={duration === mins}
                    onClick={() => setDuration(mins)}
                    className={choiceClass(duration === mins)}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={labelClass}>Starter reminders (optional)</legend>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  aria-pressed={morningMedication}
                  onClick={() => setMorningMedication((v) => !v)}
                  className={choiceClass(morningMedication)}
                >
                  Morning medication at 8:00
                </button>
                <button
                  type="button"
                  aria-pressed={hydration}
                  onClick={() => setHydration((v) => !v)}
                  className={choiceClass(hydration)}
                >
                  Water every 2 hours
                </button>
              </div>
            </fieldset>

            {where === 'shared' ? (
              <div>
                <label htmlFor="new-patient-photo" className={labelClass}>
                  Photo (recommended)
                </label>
                <p className="mb-3 text-patient-sm text-ink-muted">
                  On a shared phone, their face is how they find their name. Kept on this phone only.
                </p>
                <input
                  id="new-patient-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  className="w-full text-caregiver-body text-ink file:mr-4 file:min-h-12 file:rounded-control file:border-2 file:border-ink-muted file:bg-surface-card file:px-4 file:font-bold file:text-ink"
                />
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-caregiver-body font-bold text-danger">
                {error}
              </p>
            ) : null}

            <BigButton
              label={saving ? 'Saving…' : `Add ${name.trim() || 'patient'}`}
              variant="primary"
              disabled={!canSave || saving}
              onClick={() => void save()}
            />
          </div>
        </>
      ) : null}

      {step === 'done' ? (
        <section className="flex flex-col gap-5">
          <h1 className="font-serif-display text-[2.25rem] font-medium leading-[1.1] text-ink">
            {name.trim()} is added
          </h1>

          {where === 'own' ? (
            <>
              <p className="text-caregiver-body text-ink-muted">
                They are in your patient list now. Set up their phone or tablet next:
              </p>
              <ol className="flex flex-col gap-3 rounded-card border border-line200 bg-surface-card p-5 text-caregiver-body text-ink">
                {[
                  'On their phone or tablet, open SMRITI.',
                  'Choose "I am the Caregiver" and sign in with the same email you use here.',
                  `On "Who uses this phone?", turn on ${name.trim()}, then go to the patient view.`,
                ].map((text, i) => (
                  <li key={text} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary-dark"
                    >
                      {i + 1}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-caregiver-body text-ink-muted">
              This phone is now shared. When SMRITI opens, it asks who is playing, and each person&apos;s games and
              reminders stay their own.
            </p>
          )}

          {warning ? (
            <p role="alert" className="rounded-tile border border-warning/50 bg-warning/5 p-4 text-caregiver-body text-ink">
              {warning}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            {where === 'shared' ? (
              <button type="button" onClick={() => router.push('/app')} className={`${buttonClass.primary} min-h-14 sm:flex-1`}>
                Go to patient view
              </button>
            ) : null}
            <Link
              href="/caregiver/dashboard"
              className={`${where === 'shared' ? buttonClass.secondary : buttonClass.primary} min-h-14 sm:flex-1`}
            >
              Back to overview
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
