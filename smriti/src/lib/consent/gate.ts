import { db, type LocalPatient } from '@/lib/db/schema';
import { loadConsent } from './consentClient';
import { isConsentValid } from './policy';

/**
 * Active patients on this phone whose consent is missing or older than the
 * current policy version — patients set up before consent existed, or before
 * the notice last changed. The caregiver area sends the caregiver through the
 * consent form for each of them before anything else.
 */
export async function patientsNeedingConsent(): Promise<LocalPatient[]> {
  let patients: LocalPatient[];
  try {
    patients = (await db.patients.toArray()).filter((p) => p.isActive !== false);
  } catch {
    return [];
  }
  const consents = await Promise.all(patients.map((p) => loadConsent(p.id)));
  return patients.filter((_, i) => !isConsentValid(consents[i], 'care'));
}
