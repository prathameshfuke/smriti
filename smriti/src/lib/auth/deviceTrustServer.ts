import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Server-only device-trust signing/verification.
 *
 * SECURITY FIX: the previous scheme (see git history on `deviceTrust.ts`)
 * "signed" a token with `btoa(patientId:caregiverId:v1)` — a value anyone
 * can compute themselves with no secret at all. Any caller could forge a
 * valid-looking token for any patient id and pass `validateToken` on the
 * server, granting unauthenticated read access to that patient's Memory
 * Bank entries and write access to their `ai_conversation_log` via
 * `/api/ai/converse` and `/api/ai/transcribe`.
 *
 * This module never gets imported by a `'use client'` file — importing
 * `node:crypto` from client code would fail the build anyway, which is a
 * useful guard against accidentally leaking `DEVICE_TRUST_SECRET` into the
 * browser bundle. Tokens are now issued exclusively by `POST /api/device-trust`
 * (an authenticated route — see that file) and verified here with HMAC-SHA256
 * against a secret that only ever lives on the server.
 */

export interface DeviceTrustToken {
  patientId: string;
  issuedAt: number;
  issuedBy: string;
  signature: string;
}

const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.DEVICE_TRUST_SECRET;
  if (!secret) {
    throw new Error(
      'DEVICE_TRUST_SECRET is not configured. Set it in the server environment ' +
        '(never NEXT_PUBLIC_-prefixed) — a long random string is fine, e.g. `openssl rand -hex 32`.',
    );
  }
  return secret;
}

function computeSignature(patientId: string, issuedBy: string, issuedAt: number): string {
  return createHmac('sha256', getSecret())
    .update(`${patientId}:${issuedBy}:${issuedAt}`)
    .digest('hex');
}

/** Issues a signed token for a patient the caller (an authenticated caregiver) has already been proven to own. */
export function signDeviceTrust(patientId: string, issuedBy: string): DeviceTrustToken {
  const issuedAt = Date.now();
  return {
    patientId,
    issuedAt,
    issuedBy,
    signature: computeSignature(patientId, issuedBy, issuedAt),
  };
}

/** Constant-time signature comparison — a plain `===` would leak timing information about how many leading bytes matched. */
function signaturesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyDeviceTrust(token: DeviceTrustToken | null | undefined): boolean {
  if (!token || !token.patientId || !token.issuedAt || !token.issuedBy || !token.signature) {
    return false;
  }

  if (Date.now() - token.issuedAt > MAX_AGE_MS) return false;

  const expected = computeSignature(token.patientId, token.issuedBy, token.issuedAt);
  try {
    return signaturesMatch(token.signature, expected);
  } catch {
    return false;
  }
}
