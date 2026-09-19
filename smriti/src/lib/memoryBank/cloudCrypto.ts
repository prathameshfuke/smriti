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
 * Consequence (deliberate, see docs/03_DATABASE.md MIGRATION 017): if the
 * passphrase is forgotten and every phone holding the unlocked key is lost,
 * the cloud copy cannot be decrypted by anyone, including the app's
 * operators. Phones that already hold the key keep working offline.
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

/** A new Memory Bank key, and its passphrase-wrapped form for the server. */
export async function createCloudKey(
  passphrase: string,
  iterations = KDF_ITERATIONS,
): Promise<{ key: Uint8Array; wrapped: WrappedCloudKey }> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) throw new Error('passphrase too short');
  const key = randomBytes(CLOUD_KEY_BYTES);
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const kek = await deriveWrappingKey(passphrase, salt, iterations);
  const sealed = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: buffer(nonce), additionalData: new TextEncoder().encode('smriti-memory-bank-key') },
      kek,
      buffer(key),
    ),
  );
  const out = new Uint8Array(NONCE_BYTES + sealed.length);
  out.set(nonce);
  out.set(sealed, NONCE_BYTES);
  return {
    key,
    wrapped: { wrapped_key: toBase64(out), salt: toBase64(salt), kdf_iterations: iterations, kdf: 'pbkdf2-sha256' },
  };
}

export async function unwrapCloudKey(passphrase: string, wrapped: WrappedCloudKey): Promise<Uint8Array> {
  const kek = await deriveWrappingKey(passphrase, fromBase64(wrapped.salt), wrapped.kdf_iterations);
  const bytes = fromBase64(wrapped.wrapped_key);
  try {
    const plain = await globalThis.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: buffer(bytes.subarray(0, NONCE_BYTES)),
        additionalData: new TextEncoder().encode('smriti-memory-bank-key'),
      },
      kek,
      buffer(bytes.subarray(NONCE_BYTES)),
    );
    if (plain.byteLength !== CLOUD_KEY_BYTES) throw new WrongPassphraseError();
    return new Uint8Array(plain);
  } catch {
    throw new WrongPassphraseError();
  }
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
