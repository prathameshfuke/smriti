import type { MemoryBankCategory } from '@/lib/supabase/types';
import type { CompanionFact } from './companion-retrieval';

/**
 * Turns Memory Bank rows into the facts Ask Smriti answers from — the only
 * source of personal facts it uses (reminders and everything else are
 * deliberately excluded). Takes a neutral shape so the server and the phone
 * build identical facts.
 */

export interface MemoryEntryLike {
  id: string;
  category: MemoryBankCategory | string;
  title: string;
  detail: string;
  relationship: string | null;
}

const KINDS = new Set(['person', 'schedule', 'life_fact', 'medication']);

export function memoryEntryToFact(entry: MemoryEntryLike): CompanionFact {
  return {
    id: `m:${entry.id}`,
    kind: KINDS.has(entry.category) ? (entry.category as CompanionFact['kind']) : 'life_fact',
    title: entry.title,
    detail: entry.detail,
    relationship: entry.relationship,
  };
}

/** Prefix marking a fact about the patient themselves rather than a Memory
 * Bank row. `selectFacts` keeps these in every prompt regardless of ranking:
 * they are two short lines, and "what is my name" is the one question a
 * person with memory loss is most likely to ask when nothing else surfaces. */
export const SELF_FACT_PREFIX = 'self:';

export interface PatientIdentity {
  displayName: string;
}

/**
 * The patient's own name, as a fact.
 *
 * It is the answer to "what is my name" — the plainest question this app
 * exists for — and until now it reached nothing: the name is captured during
 * onboarding into `patients.displayName`, while Ask Smriti only ever sees
 * Memory Bank rows, so the companion truthfully said it had nothing written
 * down. Derived here rather than copied into a Memory Bank entry, so
 * renaming the patient can never leave a stale fact behind, and built from
 * the same shape on the phone and on the server.
 *
 * Their address is not here: it is a caregiver-written `life_fact` entry
 * (onboarding offers it), so it stays editable and translatable like every
 * other fact.
 */
export function patientIdentityFacts(patient: PatientIdentity | null | undefined): CompanionFact[] {
  const name = patient?.displayName?.trim();
  if (!name) return [];
  return [
    {
      id: `${SELF_FACT_PREFIX}name`,
      kind: 'life_fact',
      title: 'Their own name',
      detail: name,
      relationship: null,
    },
  ];
}
