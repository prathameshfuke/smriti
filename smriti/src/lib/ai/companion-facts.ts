import type { MemoryBankCategory } from '@/lib/supabase/types';
import { significantWords, type CompanionFact } from './companion-retrieval';

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


/**
 * "What is my name" / "who am I", in the scripts and phrasings this app is
 * used in.
 *
 * Needed only offline. On the server the name fact is pinned into every
 * prompt (api/ai/converse/route.ts) and the model reads every script, so no
 * matching is required there. Offline there is no model: `bestLocalFact`
 * reads an entry back only on a strong lexical match, and an Assamese or
 * Hindi question shares no word with the English "Their own name", so the
 * phone said it could not check — while holding the answer.
 *
 * Deliberately narrow: a question is an identity question only when, after
 * stopwords, every remaining word is a name word or a first-person word. So
 * "what is my son's name" ("son" is left over) is NOT one, and the patient's
 * own name can never be read back as somebody else's.
 */
const IDENTITY_NAME_WORDS = new Set([
  'name', 'names', 'called', 'naam', 'nam',
  'नाम', // Hindi / Nepali / Bodo
  'নাম', // Assamese / Bengali / Manipuri
  'পৰিচয়', 'পরিচয়', // "identity"
]);

/** First-person and "who" words that survive `significantWords`' stopword list. */
const IDENTITY_SELF_WORDS = new Set([
  'main', 'mai', 'hoon', 'hun', 'moi', 'ami', 'kaun', 'kun',
  'मैं', 'मै', 'हूँ', 'हूं', 'हु', 'मुझे', 'मुझको', 'मलाई',
  'মই', 'আমি', 'মোক', 'আমাকে', 'হয়', 'হৈছো',
]);

/** Phrasings with no significant word left at all ("who am I"). */
const WHO_AM_I =
  /who\s*am\s*i\b|main\s*kaun|mai\s*kaun|moi\s*kun|ami\s*ke\b|मैं\s*कौन|मै\s*कौन|म\s*को\s*हुँ|মই\s*কোন|আমি\s*কে/iu;

export function isIdentityQuestion(question: string): boolean {
  if (WHO_AM_I.test(question)) return true;
  const words = significantWords(question);
  if (!words.some((w) => IDENTITY_NAME_WORDS.has(w))) return false;
  return words.every((w) => IDENTITY_NAME_WORDS.has(w) || IDENTITY_SELF_WORDS.has(w));
}
