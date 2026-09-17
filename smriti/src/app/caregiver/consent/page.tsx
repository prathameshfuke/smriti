'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import ConsentForm from '@/components/caregiver/ConsentForm';
import { db, type LocalPatient } from '@/lib/db/schema';
import { getLocalConsent, saveConsent } from '@/lib/consent/consentClient';
import { patientsNeedingConsent } from '@/lib/consent/gate';
import { EMPTY_CONSENT_CHOICES, hasRequiredChoices, type ConsentChoices } from '@/lib/consent/policy';
import { usePatientStore } from '@/stores/patientStore';

/** Only same-app paths are followed, never an absolute URL from the query string. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/caregiver/') && !value.startsWith('//') ? value : '/caregiver/dashboard';
}

/**
 * Where the caregiver area sends a caregiver whose patient has no valid
 * consent (`?next=` returns them afterwards), and where Settings links to
 * review or change consent (`?review=1`, for the current patient).
 */
export default function CaregiverConsentPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<LocalPatient[] | null>(null);
  const [choices, setChoices] = useState<ConsentChoices>(EMPTY_CONSENT_CHOICES);
  const [next, setNext] = useState('/caregiver/dashboard');
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reviewing = params.get('review') === '1';
    void (async () => {
      setNext(safeNext(params.get('next')));
      setReview(reviewing);
      const current = usePatientStore.getState().currentPatient;
      const pending = reviewing && current ? [current] : await patientsNeedingConsent();
      setQueue(pending);
    })();
  }, []);

  const patient = queue?.[0] ?? null;

  useEffect(() => {
    if (!queue) return;
    if (!patient) {
      router.replace(next);
      return;
    }
    // Prefill what was agreed before, so a policy update only asks for a re-read.
    void getLocalConsent(patient.id).then((existing) =>
      setChoices(
        existing
          ? {
              careProfile: existing.careProfile,
              guardianAttested: existing.guardianAttested,
              aiCompanion: existing.aiCompanion,
              voiceProcessing: existing.voiceProcessing,
            }
          : EMPTY_CONSENT_CHOICES,
      ),
    );
  }, [queue, patient, next, router]);

  const save = async () => {
    if (!patient || !hasRequiredChoices(choices) || saving) return;
    setSaving(true);
    setError(null);
    try {
      const caregiver = await db.caregivers.toCollection().first();
      await saveConsent(patient.id, caregiver?.id ?? patient.caregiverId, choices);
      setQueue((q) => (q ? q.slice(1) : q));
    } catch {
      setError('Could not save your choices on this phone. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!queue || !patient) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-8" aria-busy="true">
        <Skeleton height={40} width="50%" />
        <Skeleton height={200} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="Privacy & consent"
        description={
          review
            ? `Review or change what you agreed to for ${patient.displayName}.`
            : `Before continuing, please review how SMRITI uses ${patient.displayName}'s information and confirm your choices.`
        }
      />
      <ConsentForm choices={choices} onChange={setChoices} patientName={patient.displayName} />
      {error ? (
        <p role="alert" className="text-caregiver-body font-bold text-danger">
          {error}
        </p>
      ) : null}
      <BigButton
        label={saving ? 'Saving…' : 'Save choices'}
        variant="primary"
        disabled={!hasRequiredChoices(choices) || saving}
        onClick={() => void save()}
      />
    </main>
  );
}
