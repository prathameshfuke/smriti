'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { PRIVACY_NOTICE, type ConsentChoices } from '@/lib/consent/policy';

export interface ConsentFormProps {
  choices: ConsentChoices;
  onChange: (choices: ConsentChoices) => void;
  /** Named in the attestation once known; generic wording before the patient is entered. */
  patientName?: string;
}

const cardClass =
  'flex cursor-pointer items-start gap-4 rounded-card border border-line200 bg-surface-card p-5 text-caregiver-body text-ink';

/** The full privacy notice, each section collapsible so the choices stay reachable on a phone. */
export function PrivacyNotice({ openSections = ['collect', 'ai', 'protect'] }: { openSections?: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      {PRIVACY_NOTICE.map((section) => (
        <details
          key={section.id}
          open={openSections.includes(section.id)}
          className="rounded-card border border-line200 bg-surface-card p-5"
        >
          <summary className="cursor-pointer text-caregiver-body font-bold text-ink">{section.heading}</summary>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-caregiver-body text-ink-muted">
            {section.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

/**
 * The consent choices themselves. Two required agreements gate setup; the AI
 * companion and voice are separate, optional, and default off, so turning
 * them on is always a deliberate choice rather than something agreed to by
 * ticking the required boxes.
 */
export default function ConsentForm({ choices, onChange, patientName }: ConsentFormProps) {
  const who = patientName?.trim() ? patientName.trim() : 'the patient';
  const set = (patch: Partial<ConsentChoices>) => {
    const next = { ...choices, ...patch };
    // Voice is part of Ask Smriti; it can't stay on without it.
    if (!next.aiCompanion) next.voiceProcessing = false;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <PrivacyNotice />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-caregiver-body font-bold text-ink">Required to continue</legend>
        <label className={cardClass}>
          <Checkbox
            className="mt-1 shrink-0"
            checked={choices.careProfile}
            onCheckedChange={(checked) => set({ careProfile: checked })}
            aria-describedby="consent-care-hint"
          />
          <span>
            I agree to SMRITI storing and using {who}&apos;s care profile, game results and reminders as described
            above.
            <span id="consent-care-hint" className="mt-1 block text-ink-muted">
              SMRITI supports cognitive care. It does not diagnose or treat any medical condition.
            </span>
          </span>
        </label>
        <label className={cardClass}>
          <Checkbox
            className="mt-1 shrink-0"
            checked={choices.guardianAttested}
            onCheckedChange={(checked) => set({ guardianAttested: checked })}
          />
          <span>
            I am {who}&apos;s caregiver, and this has been explained to them in a language they understand and they
            agreed — or I am legally allowed to decide for them.
          </span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-caregiver-body font-bold text-ink">Optional — you can change these later</legend>
        <label className={cardClass}>
          <Checkbox
            className="mt-1 shrink-0"
            checked={choices.aiCompanion}
            onCheckedChange={(checked) => set({ aiCompanion: checked })}
          />
          <span>
            Turn on Ask Smriti, a conversation companion. Messages, the recent conversation and related Memory Bank
            entries are sent to an AI model provider to reply, and saved for you to review.
          </span>
        </label>
        <label className={`${cardClass} ${choices.aiCompanion ? '' : 'cursor-not-allowed opacity-60'}`}>
          <Checkbox
            className="mt-1 shrink-0"
            checked={choices.voiceProcessing}
            disabled={!choices.aiCompanion}
            onCheckedChange={(checked) => set({ voiceProcessing: checked })}
          />
          <span>
            Let {who} ask by speaking. The recording is sent for speech recognition; SMRITI keeps only the text.
            {choices.aiCompanion ? null : (
              <span className="mt-1 block text-ink-muted">Needs Ask Smriti turned on.</span>
            )}
          </span>
        </label>
      </fieldset>
    </div>
  );
}
