/**
 * Device trust token management for kiosk-mode authentication.
 * Tokens are HMAC-signed server-side (see api/device-trust/route.ts and
 * lib/auth/deviceTrustServer.ts) and stored locally in IndexedDB — this
 * module only ever stores and reads whatever the server issued, it never
 * computes a signature itself. An earlier version signed tokens locally
 * with no secret at all (`btoa(patientId:caregiverId)`), which meant any
 * caller could forge a valid-looking token for any patient; that path is
 * gone.
 *
 * Storage itself is a plain Dexie table (`db.deviceTrust`, see
 * lib/db/schema.ts) — this module used to open a second, hand-rolled native
 * IndexedDB connection to that same `smriti` database, independently
 * versioned at a hardcoded 1. Two connections to one physical database each
 * claiming their own version is invalid by construction: as soon as Dexie
 * (opened for anything else — every onboarding writes the caregiver/patient
 * via Dexie before device trust is ever touched) bumped the real on-disk
 * version past 1, this module's own `indexedDB.open(DB_NAME, 1)` became a
 * permanent `VersionError`, silently caught here and surfaced only as "no
 * token" / a swallowed `console.error` in the onboarding UI — device trust
 * could never actually be established, though `restoreLocalSession`'s
 * first-active-patient fallback masked it for a single-patient device.
 */

import { authedFetch } from '@/lib/api/client';
import { db, type DeviceTrustToken } from '@/lib/db/schema';

export type { DeviceTrustToken };

/** The original single-patient row. Still read, so existing installs keep
 * working; new links are written per patient under PATIENT_KEY_PREFIX. */
const TOKEN_KEY = 'deviceTrustToken';
const PATIENT_KEY_PREFIX = 'patient:';
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function fresh(token: DeviceTrustToken | undefined): DeviceTrustToken | null {
  if (!token) return null;
  return Date.now() - token.issuedAt > MAX_AGE_MS ? null : token;
}

/**
 * This phone's signed trust token for one patient. A phone can now be shared,
 * so there is one token per patient. With no `patientId`, it is the token for
 * whoever is playing right now. Only when nobody is selected does it fall
 * back to the legacy single token or any token.
 *
 * Never another patient's token for a known patient: the server grounds
 * companion answers and family notes in the token's patient, so borrowing
 * one would answer Hari from Maya's Memory Bank (or, after a different
 * caregiver signs in on the phone, from another family's patient).
 */
export async function getDeviceTrustToken(patientId?: string): Promise<DeviceTrustToken | null> {
  try {
    const targetId = patientId ?? (await currentPatientId());
    if (targetId) {
      const own = fresh(await db.deviceTrust.get(`${PATIENT_KEY_PREFIX}${targetId}`));
      if (own) return own;
      const legacy = fresh(await db.deviceTrust.get(TOKEN_KEY));
      if (legacy && legacy.patientId === targetId) return legacy;
      return null;
    }
    const legacy = fresh(await db.deviceTrust.get(TOKEN_KEY));
    if (legacy) return legacy;
    const all = await db.deviceTrust.toArray();
    return all.map(fresh).find((t): t is DeviceTrustToken => t !== null) ?? null;
  } catch {
    return null;
  }
}

async function currentPatientId(): Promise<string | null> {
  // Imported lazily: the patient store imports the database layer, and a
  // top-level import here would load it for every server-side caller too.
  const { usePatientStore } = await import('@/stores/patientStore');
  return usePatientStore.getState().currentPatient?.id ?? null;
}

/** Every patient this phone holds a valid trust token for. */
export async function getTrustedPatientIds(): Promise<string[]> {
  try {
    const tokens = await db.deviceTrust.toArray();
    return [...new Set(tokens.map(fresh).filter((t): t is DeviceTrustToken => t !== null).map((t) => t.patientId))];
  } catch {
    return [];
  }
}

/**
 * Requests a signed trust token from the server for a patient the caller's
 * own Supabase session is authorized for (checked server-side — see
 * api/device-trust/route.ts), and stores it locally next to any tokens this
 * phone already holds for other patients. Requires connectivity: a
 * locally-computed signature would be forgeable by construction.
 */
export async function setDeviceTrustToken(patientId: string): Promise<void> {
  try {
    const { token } = await authedFetch<{ token: DeviceTrustToken }>('/api/device-trust', {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    });

    await db.deviceTrust.put(token, `${PATIENT_KEY_PREFIX}${patientId}`);
  } catch (err) {
    throw new Error(`Failed to set device trust token: ${err}`);
  }
}

/** Stops this phone being used by one patient. Their data stays on the account. */
export async function removeDeviceTrust(patientId: string): Promise<void> {
  await db.deviceTrust.delete(`${PATIENT_KEY_PREFIX}${patientId}`);
  const legacy = await db.deviceTrust.get(TOKEN_KEY);
  if (legacy?.patientId === patientId) await db.deviceTrust.delete(TOKEN_KEY);
}

export async function clearDeviceTrustToken(): Promise<void> {
  try {
    await db.deviceTrust.clear();
  } catch (err) {
    throw new Error(`Failed to clear device trust token: ${err}`);
  }
}

/**
 * Local, non-cryptographic shape/freshness check only — this is NOT a
 * security boundary and must never be used to authorize a server request.
 * The server independently re-verifies the signature itself (see
 * lib/auth/deviceTrustServer.ts) on every request that matters; this is
 * purely so the UI can skip showing a stale/malformed token to the caller
 * before it even tries the network.
 */
export function isTokenWellFormed(token: DeviceTrustToken): boolean {
  if (!token.patientId || !token.issuedAt || !token.issuedBy || !token.signature) {
    return false;
  }
  const age = Date.now() - token.issuedAt;
  const maxAge = 365 * 24 * 60 * 60 * 1000;
  return age <= maxAge;
}
