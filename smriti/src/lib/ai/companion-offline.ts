import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db/schema';
import { matchSeverity } from './distress-keywords';
import { isIdentityQuestion, memoryEntryToFact, patientIdentityFacts, SELF_FACT_PREFIX } from './companion-facts';
import { bestLocalFact, describeFact, type CompanionFact } from './companion-retrieval';
import { cacheAnswer } from './companion-cache';

export type OfflineAnswer =
  | { kind: 'distress' }
  | { kind: 'memoryBook'; text: string }
  | { kind: 'none' };

/** Model names the server accepts for answers uploaded from the phone (see api/sync/route.ts). */
const ON_DEVICE_MODEL = 'on-device';
const ON_DEVICE_DISTRESS_MODEL = 'on-device-distress';

const OFFLINE_DISTRESS_LOG =
  'Shown the Tele-MANAS helpline (14416) on the phone while offline.';

async function localFacts(patientId: string, patientName?: string | null): Promise<CompanionFact[]> {
  const entries = await db.memoryBankEntries.where('patientId').equals(patientId).filter((e) => e.active).toArray();
  return [...patientIdentityFacts(patientName ? { displayName: patientName } : null), ...entries.map(memoryEntryToFact)];
}

/**
 * Ask Smriti without a connection. No model runs on the phone, so this never
 * composes an answer: it checks the question for distress (the same keywords
 * the server uses) and otherwise reads back the one saved Memory Bank entry
 * that clearly matches, exactly as the caregiver wrote it.
 *
 * Both outcomes are queued for the caregiver's log (`pendingSync`) and
 * uploaded by the next sync, so a distress phrase said offline is still
 * flagged to them.
 */
export async function answerOffline(
  patientId: string,
  question: string,
  patientName?: string | null,
): Promise<OfflineAnswer> {
  const log = (answer: string, model: string, grounded: boolean) =>
    cacheAnswer({
      id: uuid(),
      patientId,
      question,
      answer,
      grounded,
      modelUsed: model,
      createdAt: new Date().toISOString(),
      pendingSync: true,
    }).catch(() => undefined);

  if (matchSeverity(question) === 'high') {
    await log(OFFLINE_DISTRESS_LOG, ON_DEVICE_DISTRESS_MODEL, false);
    return { kind: 'distress' };
  }

  let facts: CompanionFact[];
  try {
    facts = await localFacts(patientId, patientName);
  } catch {
    return { kind: 'none' };
  }
  // "Who am I" in any of the app's languages: the name is held right here,
  // and word matching cannot carry an Assamese question to an English
  // "Their own name". Only ever the patient's own identity fact — see
  // isIdentityQuestion.
  const identity = isIdentityQuestion(question)
    ? facts.find((f) => f.id === `${SELF_FACT_PREFIX}name`)
    : undefined;
  // The self fact is reached only that way. Left in the ranking it would win
  // "what is my daughter's name" on the word "name" in its own English title
  // and read the patient their own name as their daughter's.
  const fact = identity ?? bestLocalFact(question, facts.filter((f) => !f.id.startsWith(SELF_FACT_PREFIX)));
  if (!fact) return { kind: 'none' };

  const text = describeFact(fact);
  await log(text, ON_DEVICE_MODEL, true);
  return { kind: 'memoryBook', text };
}
