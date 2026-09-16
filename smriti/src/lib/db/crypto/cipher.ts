import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, randomBytes, utf8ToBytes } from '@noble/ciphers/utils.js';

/**
 * Field-level AES-256-GCM for the local IndexedDB mirror.
 *
 * Synchronous on purpose. Dexie runs every read and write inside a native
 * IndexedDB transaction, and a transaction commits as soon as control returns
 * to the event loop with no request pending. Awaiting `crypto.subtle` inside
 * one therefore ends it early (`TransactionInactiveError`). The async WebCrypto
 * work happens once, before any transaction, when the key is unwrapped (see
 * `keys.ts`); everything per-row stays synchronous here.
 *
 * Stored format: `enc1:` + base64(nonce ‖ ciphertext ‖ tag). The plaintext is
 * the JSON encoding of the value, so strings, arrays and objects all round-trip.
 * The additional authenticated data is `table.field`, so a ciphertext copied
 * into another field or table fails to decrypt instead of being accepted.
 */

export const ENCRYPTED_PREFIX = 'enc1:';
export const STORAGE_KEY_BYTES = 32;
const NONCE_BYTES = 12;

export class StorageLockedError extends Error {
  constructor() {
    super('Local storage key is not loaded yet');
    this.name = 'StorageLockedError';
  }
}

export class StorageDecryptError extends Error {
  constructor(context: string) {
    super(`Could not decrypt local data (${context})`);
    this.name = 'StorageDecryptError';
  }
}

export function generateStorageKey(): Uint8Array {
  return randomBytes(STORAGE_KEY_BYTES);
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptValue(key: Uint8Array, value: unknown, context: string): string {
  const nonce = randomBytes(NONCE_BYTES);
  const sealed = gcm(key, nonce, utf8ToBytes(context)).encrypt(utf8ToBytes(JSON.stringify(value)));
  const out = new Uint8Array(NONCE_BYTES + sealed.length);
  out.set(nonce);
  out.set(sealed, NONCE_BYTES);
  return ENCRYPTED_PREFIX + toBase64(out);
}

export function decryptValue(key: Uint8Array, stored: string, context: string): unknown {
  try {
    const bytes = fromBase64(stored.slice(ENCRYPTED_PREFIX.length));
    const nonce = bytes.subarray(0, NONCE_BYTES);
    const plain = gcm(key, nonce, utf8ToBytes(context)).decrypt(bytes.subarray(NONCE_BYTES));
    return JSON.parse(bytesToUtf8(plain));
  } catch {
    throw new StorageDecryptError(context);
  }
}

// btoa/atob only take binary strings; build them in chunks so large photo
// data URLs don't blow the argument limit of String.fromCharCode.
const CHUNK = 0x8000;

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function fromBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
