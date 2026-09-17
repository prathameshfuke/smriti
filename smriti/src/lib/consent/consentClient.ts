import { db, type LocalConsent } from '@/lib/db/schema';
import { clearCachedAnswers } from '@/lib/ai/companion-cache';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { buildConsentRecord, type ConsentChoices, type ConsentRecord } from './policy';
import { fromWireConsent, toWireConsent } from './wire';

/**
 * Client half of the consent guardrail: the phone's copy of each patient's
 * consent, written the moment the caregiver submits the form (so every
 * on-device check works offline) and mirrored to `patient_consents`, where
 * the AI routes check it independently.
 */

const NETWORK_TIMEOUT_MS = 8_000;

function withTimeout<T>(thenable: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(thenable),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), NETWORK_TIMEOUT_MS)),
  ]);
}

function stripLocal(row: LocalConsent): ConsentRecord {
  const record: ConsentRecord & { synced?: boolean } = { ...row };
  delete record.synced;
  return record;
}

export async function getLocalConsent(patientId: string): Promise<ConsentRecord | null> {
  try {
    const row = await db.consents.get(patientId);
    return row ? stripLocal(row) : null;
  } catch {
    return null;
  }
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

/** Best-effort upload. Returns true only when the server confirmed it. */
export async function pushConsent(record: ConsentRecord): Promise<boolean> {
  if (!isSupabaseConfigured() || !isOnline()) return false;
  try {
    const { error } = await withTimeout(
      createBrowserClient().from('patient_consents').upsert(toWireConsent(record) as never, { onConflict: 'patient_id' }),
    );
    if (error) return false;
    // Only if nothing newer was saved while the upload was in flight.
    await db.consents
      .where('patientId')
      .equals(record.patientId)
      .filter((row) => row.updatedAt === record.updatedAt)
      .modify({ synced: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves the caregiver's choices for one patient locally (immediately
 * effective on this phone) and tries to upload them. An upload that fails
 * stays `synced: false` and goes up with the next `/api/sync`.
 *
 * Withdrawing Ask Smriti also clears the phone's cached answers for that
 * patient, so nothing the AI produced keeps being shown after consent ends.
 */
export async function saveConsent(
  patientId: string,
  caregiverId: string,
  choices: ConsentChoices,
  options: { push?: boolean } = {},
): Promise<ConsentRecord> {
  const previous = await getLocalConsent(patientId);
  const record = buildConsentRecord(patientId, caregiverId, choices, previous);
  await db.consents.put({ ...record, synced: false });
  if (!record.aiCompanion) {
    await clearCachedAnswers(patientId);
  }
  if (options.push ?? true) await pushConsent(record);
  return record;
}

/**
 * The phone's consent for a patient, pulling the account copy when this
 * phone has none yet (a patient's own phone signing in after the caregiver
 * agreed on theirs). A server copy only replaces a local one that is older.
 */
export async function loadConsent(patientId: string): Promise<ConsentRecord | null> {
  const local = await getLocalConsent(patientId);
  if (local || !isSupabaseConfigured() || !isOnline()) return local;
  try {
    const { data, error } = await withTimeout(
      createBrowserClient().from('patient_consents').select('*').eq('patient_id', patientId).maybeSingle(),
    );
    if (error || !data) return local;
    const remote = fromWireConsent(data);
    await applyServerConsent(remote);
    return remote;
  } catch {
    return local;
  }
}

/** Last-write-wins merge of a consent the server sent; never overwrites an unsent local change. */
export async function applyServerConsent(remote: ConsentRecord): Promise<void> {
  const local = await db.consents.get(remote.patientId);
  if (local && (!local.synced || Date.parse(local.updatedAt) >= Date.parse(remote.updatedAt))) return;
  await db.consents.put({ ...remote, synced: true });
}
