import type { PatientConsent } from '@/lib/supabase/types';
import type { ConsentRecord } from './policy';

/** camelCase local record ⇄ snake_case `patient_consents` row. */
export function toWireConsent(record: ConsentRecord): PatientConsent {
  return {
    patient_id: record.patientId,
    caregiver_id: record.consentedBy,
    version: record.version,
    care_profile: record.careProfile,
    guardian_attested: record.guardianAttested,
    ai_companion: record.aiCompanion,
    voice_processing: record.aiCompanion && record.voiceProcessing,
    consented_at: record.consentedAt,
    updated_at: record.updatedAt,
  };
}

export function fromWireConsent(row: PatientConsent): ConsentRecord {
  return {
    patientId: row.patient_id,
    version: row.version,
    careProfile: row.care_profile,
    guardianAttested: row.guardian_attested,
    aiCompanion: row.ai_companion,
    voiceProcessing: row.ai_companion && row.voice_processing,
    consentedBy: row.caregiver_id,
    consentedAt: row.consented_at,
    updatedAt: row.updated_at,
  };
}

/** Accepts only a structurally complete consent from an untrusted request body. */
export function parseConsentRecord(value: unknown): ConsentRecord | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const bools = ['careProfile', 'guardianAttested', 'aiCompanion', 'voiceProcessing'] as const;
  const strings = ['patientId', 'consentedBy', 'consentedAt', 'updatedAt'] as const;
  if (typeof v.version !== 'number' || !Number.isInteger(v.version) || v.version < 1) return null;
  if (!bools.every((k) => typeof v[k] === 'boolean')) return null;
  if (!strings.every((k) => typeof v[k] === 'string' && (v[k] as string).length > 0)) return null;
  if (Number.isNaN(Date.parse(v.consentedAt as string)) || Number.isNaN(Date.parse(v.updatedAt as string))) return null;
  return {
    patientId: v.patientId as string,
    version: v.version,
    careProfile: v.careProfile as boolean,
    guardianAttested: v.guardianAttested as boolean,
    aiCompanion: v.aiCompanion as boolean,
    voiceProcessing: (v.aiCompanion as boolean) && (v.voiceProcessing as boolean),
    consentedBy: v.consentedBy as string,
    consentedAt: v.consentedAt as string,
    updatedAt: v.updatedAt as string,
  };
}
