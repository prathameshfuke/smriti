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

const TOKEN_KEY = 'deviceTrustToken';
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export async function getDeviceTrustToken(): Promise<DeviceTrustToken | null> {
  try {
    const token = await db.deviceTrust.get(TOKEN_KEY);
    if (!token) return null;

    // Validate token expiry (365 days)
    const age = Date.now() - token.issuedAt;
    if (age > MAX_AGE_MS) return null;

    return token;
  } catch {
    return null;
  }
}

/**
 * Requests a signed trust token from the server for a patient the caller's
 * own Supabase session is authorized for (checked server-side — see
 * api/device-trust/route.ts), and stores it locally. Requires connectivity:
 * a locally-computed signature would be forgeable by construction, so there
 * is no offline path to minting trust — an offline caregiver can finish the
 * rest of onboarding, but this step must be retried once online.
 */
export async function setDeviceTrustToken(patientId: string): Promise<void> {
  try {
    const { token } = await authedFetch<{ token: DeviceTrustToken }>('/api/device-trust', {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    });

    await db.deviceTrust.put(token, TOKEN_KEY);
  } catch (err) {
    throw new Error(`Failed to set device trust token: ${err}`);
  }
}

export async function clearDeviceTrustToken(): Promise<void> {
  try {
    await db.deviceTrust.delete(TOKEN_KEY);
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
