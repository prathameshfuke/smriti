import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { decryptValue, encryptValue, fromBase64, isEncrypted, toBase64 } from '@/lib/db/crypto/cipher';

/**
 * End-to-end encryption for the Memory Bank copy kept in Supabase.
 *
 * The Memory Bank holds names, relationships, places and routines of a
 * vulnerable person, so the cloud copy is encrypted on the phone before it is
 * sent: Supabase (and anyone with database or storage access) only ever sees
 * ciphertext. No custom cryptography:
 *
 * - Content: AES-256-GCM from @noble/ciphers (audited), the same primitive
 *   and `enc1:` format already used for the on-device store (db/crypto).
 *   Each field's additional data is `memory_bank_entries:<id>:<field>`, so a
 *   ciphertext moved to another row or column fails to decrypt.
 * - Key: one random 256-bit Memory Bank key per caregiver account. It is
 *   stored in Supabase only wrapped (AES-GCM, WebCrypto) under a key derived
 *   from the caregiver's backup passphrase with PBKDF2-SHA256 (600,000
 *   iterations, OWASP 2023 guidance, random 16-byte salt). The passphrase
 *   never leaves the phone and is never stored.
 *
 * The same key is wrapped a second time under a recovery code shown once at
 * setup (MIGRATION 018), so a forgotten passphrase is recoverable from the
 * written-down code. Both wrappings protect the same key, and neither the
 * passphrase nor the code ever reaches the server.
 *
 * Consequence (deliberate, see docs/03_DATABASE.md MIGRATION 017): if the
 * passphrase AND the recovery code are both lost, and every phone holding the
 * unlocked key is gone, the cloud copy cannot be decrypted by anyone,
 * including the app's operators. Phones that already hold the key keep
 * working offline.
 */

export const KDF_ITERATIONS = 600_000;
export const CLOUD_KEY_BYTES = 32;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
export const MIN_PASSPHRASE_LENGTH = 10;

/** The wrapped key as stored in `memory_bank_keys`. */
export interface WrappedCloudKey {
  wrapped_key: string;
  salt: string;
  kdf_iterations: number;
  kdf: 'pbkdf2-sha256';
  /** The same key wrapped under the recovery code. Absent on rows written
   * before MIGRATION 018, which can only be unlocked with the passphrase. */
  recovery_wrapped_key?: string | null;
  recovery_salt?: string | null;
}

export class WrongRecoveryCodeError extends Error {
  constructor() {
    super('The recovery code is not correct');
    this.name = 'WrongRecoveryCodeError';
  }
}

export class NoRecoveryCodeError extends Error {
  constructor() {
    super('This account has no recovery code');
    this.name = 'NoRecoveryCodeError';
  }
}

/**
 * Crockford base32 without I, L, O and U: no character can be confused with
 * another when the code is written down by hand and typed back in.
 */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_GROUPS = 6;
const CODE_GROUP_LENGTH = 4;

/** A fresh recovery code, e.g. `H4TK-9Q2M-…` (24 characters, ~120 bits). */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(CODE_GROUPS * CODE_GROUP_LENGTH);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return Array.from({ length: CODE_GROUPS }, (_, i) =>
    chars.slice(i * CODE_GROUP_LENGTH, (i + 1) * CODE_GROUP_LENGTH).join(''),
  ).join('-');
}

/**
 * Accepts the code however it was written down: lower case, missing or extra
 * dashes and spaces, and the letters people substitute for digits.
 */
export function normalizeRecoveryCode(code: string): string {
  const cleaned = code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
  return cleaned.replace(new RegExp(`(.{${CODE_GROUP_LENGTH}})(?=.)`, 'g'), '$1-');
}

export function isWellFormedRecoveryCode(code: string): boolean {
  const c = normalizeRecoveryCode(code).replace(/-/g, '');
  return c.length === CODE_GROUPS * CODE_GROUP_LENGTH && [...c].every((ch) => CODE_ALPHABET.includes(ch));
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('The backup passphrase is not correct');
    this.name = 'WrongPassphraseError';
  }
}

function buffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

async function deriveWrappingKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const material = await subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFKC')), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: buffer(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Wraps `key` under a secret (passphrase or recovery code). */
async function sealKey(key: Uint8Array, secret: string, iterations: number): Promise<{ sealed: string; salt: string }> {
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const kek = await deriveWrappingKey(secret, salt, iterations);
  const sealed = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: buffer(nonce), additionalData: new TextEncoder().encode(KEY_CONTEXT) },
      kek,
      buffer(key),
    ),
  );
  const out = new Uint8Array(NONCE_BYTES + sealed.length);
  out.set(nonce);
  out.set(sealed, NONCE_BYTES);
  return { sealed: toBase64(out), salt: toBase64(salt) };
}

async function openKey(stored: string, salt: string, secret: string, iterations: number): Promise<Uint8Array | null> {
  const kek = await deriveWrappingKey(secret, fromBase64(salt), iterations);
  const bytes = fromBase64(stored);
  try {
    const plain = await globalThis.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: buffer(bytes.subarray(0, NONCE_BYTES)),
        additionalData: new TextEncoder().encode(KEY_CONTEXT),
      },
      kek,
      buffer(bytes.subarray(NONCE_BYTES)),
    );
    return plain.byteLength === CLOUD_KEY_BYTES ? new Uint8Array(plain) : null;
  } catch {
    return null;
  }
}

const KEY_CONTEXT = 'smriti-memory-bank-key';

/**
 * A new Memory Bank key, wrapped for the server under both the caregiver's
 * passphrase and a freshly generated recovery code. The code is returned so
 * it can be shown once and written down; it is never stored anywhere else.
 */
export async function createCloudKey(
  passphrase: string,
  iterations = KDF_ITERATIONS,
): Promise<{ key: Uint8Array; wrapped: WrappedCloudKey; recoveryCode: string }> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) throw new Error('passphrase too short');
  const key = randomBytes(CLOUD_KEY_BYTES);
  const recoveryCode = generateRecoveryCode();
  const byPassphrase = await sealKey(key, passphrase, iterations);
  const byCode = await sealKey(key, recoveryCode, iterations);
  return {
    key,
    recoveryCode,
    wrapped: {
      wrapped_key: byPassphrase.sealed,
      salt: byPassphrase.salt,
      kdf_iterations: iterations,
      kdf: 'pbkdf2-sha256',
      recovery_wrapped_key: byCode.sealed,
      recovery_salt: byCode.salt,
    },
  };
}

export async function unwrapCloudKey(passphrase: string, wrapped: WrappedCloudKey): Promise<Uint8Array> {
  const key = await openKey(wrapped.wrapped_key, wrapped.salt, passphrase, wrapped.kdf_iterations);
  if (!key) throw new WrongPassphraseError();
  return key;
}

/** Opens the key with the recovery code shown at setup. */
export async function unwrapWithRecoveryCode(code: string, wrapped: WrappedCloudKey): Promise<Uint8Array> {
  if (!wrapped.recovery_wrapped_key || !wrapped.recovery_salt) throw new NoRecoveryCodeError();
  const key = await openKey(
    wrapped.recovery_wrapped_key,
    wrapped.recovery_salt,
    normalizeRecoveryCode(code),
    wrapped.kdf_iterations,
  );
  if (!key) throw new WrongRecoveryCodeError();
  return key;
}

/**
 * Re-wraps an already-opened key under a new passphrase, keeping the same
 * recovery wrapping (and so the same code). Used after a recovery unlock, so
 * the caregiver gets a passphrase they know again without the entries having
 * to be re-encrypted.
 */
export async function rewrapWithPassphrase(
  key: Uint8Array,
  passphrase: string,
  previous: WrappedCloudKey,
  iterations = KDF_ITERATIONS,
): Promise<WrappedCloudKey> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) throw new Error('passphrase too short');
  const byPassphrase = await sealKey(key, passphrase, iterations);
  return {
    ...previous,
    wrapped_key: byPassphrase.sealed,
    salt: byPassphrase.salt,
    kdf_iterations: iterations,
    kdf: 'pbkdf2-sha256',
  };
}

/** Fields of `memory_bank_entries` that are encrypted in the cloud. */
export const CLOUD_ENCRYPTED_FIELDS = ['title', 'detail', 'relationship', 'photo_url'] as const;
type CloudField = (typeof CLOUD_ENCRYPTED_FIELDS)[number];

function context(id: string, field: CloudField): string {
  return `memory_bank_entries:${id}:${field}`;
}

export function encryptCloudField(key: Uint8Array, id: string, field: CloudField, value: string): string;
export function encryptCloudField(key: Uint8Array, id: string, field: CloudField, value: string | null): string | null;
export function encryptCloudField(key: Uint8Array, id: string, field: CloudField, value: string | null) {
  return value == null ? null : encryptValue(key, value, context(id, field));
}

export function decryptCloudField(key: Uint8Array, id: string, field: CloudField, stored: string | null): string | null {
  if (stored == null) return null;
  // Never trust a plaintext value from the server: rows written before
  // encryption are treated as unreadable rather than shown.
  if (!isEncrypted(stored)) throw new Error(`memory_bank_entries.${field} is not encrypted`);
  const value = decryptValue(key, stored, context(id, field));
  if (typeof value !== 'string') throw new Error(`memory_bank_entries.${field} has an unexpected shape`);
  return value;
}

/** Encrypts photo bytes for the private Storage bucket: nonce ‖ ciphertext ‖ tag. */
export function encryptPhotoBytes(key: Uint8Array, id: string, bytes: Uint8Array): Uint8Array {
  const nonce = randomBytes(NONCE_BYTES);
  const sealed = gcm(key, nonce, new TextEncoder().encode(`memory-bank-photo:${id}`)).encrypt(bytes);
  const out = new Uint8Array(NONCE_BYTES + sealed.length);
  out.set(nonce);
  out.set(sealed, NONCE_BYTES);
  return out;
}

export function decryptPhotoBytes(key: Uint8Array, id: string, sealed: Uint8Array): Uint8Array {
  return gcm(key, sealed.subarray(0, NONCE_BYTES), new TextEncoder().encode(`memory-bank-photo:${id}`)).decrypt(
    sealed.subarray(NONCE_BYTES),
  );
}
