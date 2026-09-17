'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Panel';
import AnimatedSwitch from '@/components/ui/AnimatedSwitch';
import { db, type LocalPatient } from '@/lib/db/schema';
import { getLocalConsent, saveConsent } from '@/lib/consent/consentClient';
import { isConsentValid, type ConsentRecord } from '@/lib/consent/policy';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Settings → Privacy & consent for the current patient: when consent was
 * given, and switches to withdraw or give the optional AI choices. Changes
 * take effect on this phone at once and on the server with the next upload.
 */
export default function PrivacyConsentSettings({ patient }: { patient: LocalPatient | null }) {
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;
    void getLocalConsent(patient.id).then((record) => {
      if (cancelled) return;
      setConsent(record);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [patient]);

  if (!patient) {
    return <p className="text-caregiver-body text-ink-muted">Choose a patient to see their privacy choices.</p>;
  }
  if (!loaded) return <p className="text-caregiver-body text-ink-muted">Checking…</p>;

  const reviewHref = `/caregiver/consent?review=1&next=${encodeURIComponent('/caregiver/settings')}`;

  if (!isConsentValid(consent, 'care') || !consent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-caregiver-body text-ink">
          {patient.displayName} has no up-to-date consent on this phone yet.
        </p>
        <Link href={reviewHref} className={`${buttonClass.primary} w-full sm:w-auto`}>
          Review and give consent
        </Link>
      </div>
    );
  }

  const update = async (patch: Partial<Pick<ConsentRecord, 'aiCompanion' | 'voiceProcessing'>>) => {
    setSaveState('saving');
    try {
      const caregiver = await db.caregivers.toCollection().first();
      const next = await saveConsent(patient.id, caregiver?.id ?? consent.consentedBy, {
        careProfile: consent.careProfile,
        guardianAttested: consent.guardianAttested,
        aiCompanion: patch.aiCompanion ?? consent.aiCompanion,
        voiceProcessing: patch.voiceProcessing ?? consent.voiceProcessing,
      });
      setConsent(next);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-caregiver-body text-ink">
        Consent given on {formatDate(consent.consentedAt)}
        {consent.updatedAt !== consent.consentedAt ? `, last changed ${formatDate(consent.updatedAt)}` : ''}.
      </p>
      <div className="flex items-center justify-between gap-4">
        <span aria-hidden="true" className="text-caregiver-body font-bold text-ink">
          Ask Smriti (AI companion)
        </span>
        <AnimatedSwitch
          checked={consent.aiCompanion}
          onChange={(checked) => void update({ aiCompanion: checked, voiceProcessing: checked && consent.voiceProcessing })}
          label="Ask Smriti (AI companion)"
          disabled={saveState === 'saving'}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <span aria-hidden="true" className="text-caregiver-body font-bold text-ink">
          Ask by speaking
        </span>
        <AnimatedSwitch
          checked={consent.voiceProcessing}
          onChange={(checked) => void update({ voiceProcessing: checked })}
          label="Ask by speaking"
          disabled={saveState === 'saving' || !consent.aiCompanion}
        />
      </div>
      <p role="status" className="text-caregiver-body text-ink-muted empty:hidden">
        {saveState === 'saved'
          ? consent.aiCompanion
            ? 'Saved.'
            : 'Saved. Ask Smriti is off and its saved answers were cleared from this phone.'
          : saveState === 'error'
            ? 'Could not save. Try again.'
            : ''}
      </p>
      <Link href={reviewHref} className={`${buttonClass.secondary} w-full sm:w-auto`}>
        Read the full privacy notice
      </Link>
    </div>
  );
}
