/**
 * Device trust token management for kiosk-mode authentication.
 * Tokens are HMAC-signed server-side (see api/device-trust/route.ts and
 * lib/auth/deviceTrustServer.ts) and stored locally in IndexedDB — this
 * module only ever stores and reads whatever the server issued, it never
 * computes a signature itself. An earlier version signed tokens locally
 * with no secret at all (`btoa(patientId:caregiverId)`), which meant any
 * caller could forge a valid-looking token for any patient; that path is
 * gone.
 */

import { authedFetch } from '@/lib/api/client';

const STORE_NAME = 'deviceTrust';
const DB_NAME = 'smriti';
const DB_VERSION = 1;
const TOKEN_KEY = 'deviceTrustToken';

export interface DeviceTrustToken {
  patientId: string;
  issuedAt: number;
  issuedBy: string;
  signature: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

async function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

  return dbPromise;
}

export async function getDeviceTrustToken(): Promise<DeviceTrustToken | null> {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(TOKEN_KEY);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const token = req.result;
        if (!token) {
          resolve(null);
          return;
        }

        // Validate token expiry (365 days)
        const age = Date.now() - token.issuedAt;
        const maxAge = 365 * 24 * 60 * 60 * 1000;
        if (age > maxAge) {
          resolve(null);
          return;
        }

        resolve(token);
      };
    });
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

    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(token, TOKEN_KEY);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  } catch (err) {
    throw new Error(`Failed to set device trust token: ${err}`);
  }
}

export async function clearDeviceTrustToken(): Promise<void> {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(TOKEN_KEY);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
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
