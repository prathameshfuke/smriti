import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Server-only signing for family-share access tokens. Mirrors
 * `lib/auth/deviceTrustServer.ts`'s scheme exactly (HMAC-SHA256, server-only
 * secret, constant-time compare) — that module was hardened this session
 * after a client-forgeable-signature vulnerability, so this one starts from
 * the fixed version rather than repeating the mistake.
 *
 * SCOPE BOUNDARY (read before extending this module): this is read-only
 * digest-level family access plus one-directional (family -> patient)
 * encouragement notes. It is explicitly NOT: multiplayer, patient-to-patient
 * comparison, leaderboards, real-time chat, or a channel for the patient to
 * message back. A future change that adds any of those is out of scope for
 * this module — open a new one instead of stretching this one's purpose.
 *
 * Never imported by a `'use client'` file — importing `node:crypto` from
 * client code fails the build, which is a useful guard against
 * FAMILY_SHARE_SECRET ending up in the browser bundle.
 */

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, per the feature spec's default expiry

function getSecret(): string {
  const secret = process.env.FAMILY_SHARE_SECRET;
  if (!secret) {
    throw new Error(
      'FAMILY_SHARE_SECRET is not configured. Set it in the server environment ' +
        '(never NEXT_PUBLIC_-prefixed) — e.g. `openssl rand -hex 32`. Kept separate ' +
        'from DEVICE_TRUST_SECRET so rotating one never invalidates the other.',
    );
  }
  return secret;
}

function computeSignature(shareId: string, patientId: string, expiresAt: string): string {
  return createHmac('sha256', getSecret()).update(`${shareId}:${patientId}:${expiresAt}`).digest('hex');
}

export function signFamilyShare(shareId: string, patientId: string, expiresAt: Date): string {
  return computeSignature(shareId, patientId, expiresAt.toISOString());
}

function signaturesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a share row's own stored signature against what it claims — used
 * on every family-facing request, not just at issuance, so a revoked or
 * tampered row never gets a free pass. Expiry and `revoked_at` are checked
 * by the caller against the DB row (this function only proves the signature
 * itself is authentic), matching the row-is-the-source-of-truth design
 * documented in migration 010.
 */
export function verifyFamilyShareSignature(
  shareId: string,
  patientId: string,
  expiresAt: string,
  storedSignature: string,
): boolean {
  try {
    return signaturesMatch(storedSignature, computeSignature(shareId, patientId, expiresAt));
  } catch {
    return false;
  }
}

export function isFamilyShareExpired(expiresAt: string): boolean {
  return Date.now() > new Date(expiresAt).getTime();
}

export const FAMILY_SHARE_DEFAULT_TTL_MS = MAX_AGE_MS;
