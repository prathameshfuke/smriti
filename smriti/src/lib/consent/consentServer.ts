import type { createServiceRoleClient } from '@/lib/supabase/client';
import { isConsentValid, type ConsentPurpose } from './policy';
import { fromWireConsent } from './wire';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/** PostgREST/Postgres codes for "this table does not exist". */
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

/**
 * Server-side half of the consent guardrail: the phone's own check can be
 * bypassed by anyone calling the API directly, this one cannot.
 *
 * Fails closed — no row, an outdated version, or the purpose switched off
 * all refuse. The single exception is a database that has not had
 * MIGRATION 014 applied yet (the table itself is missing): refusing there
 * would switch Ask Smriti off for every existing deployment the moment this
 * code ships, while the phone still enforces the caregiver's recorded
 * choice. That case is logged loudly so it gets fixed, not silently relied on.
 */
export async function hasServerConsent(
  service: ServiceClient,
  patientId: string,
  purpose: ConsentPurpose,
): Promise<boolean> {
  const { data, error } = await service
    .from('patient_consents')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error) {
    if (MISSING_TABLE_CODES.has(error.code ?? '')) {
      console.error('SMRITI: patient_consents table missing — apply MIGRATION 014. Consent enforced on device only.');
      return true;
    }
    return false;
  }
  return isConsentValid(data ? fromWireConsent(data) : null, purpose);
}
