import type Dexie from 'dexie';
import type { Table } from 'dexie';
import {
  decryptValue,
  encryptValue,
  fromBase64,
  generateStorageKey,
  isEncrypted,
  StorageDecryptError,
  STORAGE_KEY_BYTES,
  toBase64,
} from './cipher';

/**
 * The one row of the `keyring` table.
 *
 * The data key that encrypts fields is never stored as-is when WebCrypto is
 * available: it is sealed with a non-extractable AES-GCM `CryptoKey`, which
 * IndexedDB can store but page script can never export. `rawKey` is only used
 * where that isn't possible (no `crypto.subtle` outside a secure context, or a
 * browser that refuses to store CryptoKey objects). In that mode the key sits
 * next to the data it encrypts, so it only keeps values out of casual view in
 * devtools; it is no protection for a copied browser profile or backup.
 *
 * What this protects: data copied out of the browser profile, device backups,
 * and anyone browsing IndexedDB in devtools. What it can't protect: a script
 * running in the page (XSS) or someone using the unlocked app, since the app
 * itself has to be able to read the data offline without a PIN.
 */
export interface KeyringEntry {
  wrappingKey?: CryptoKey;
  /** Base64, like `iv` and `rawKey`. Strings survive every structured-clone
   * implementation; typed arrays from another realm don't always. */
  wrappedKey?: string;
  iv?: string;
  rawKey?: string;
  /** Highest `ENCRYPTION_MIGRATION_VERSION` whose re-encryption pass finished. */
  migratedVersion?: number;
  createdAt: string;
}

export const KEYRING_ID = 'storage';
export const ENCRYPTION_MIGRATION_VERSION = 1;

type Keyring = Table<KeyringEntry, string>;

export interface LoadedKey {
  key: Uint8Array;
  entry: KeyringEntry;
  /** True when no usable key existed and a new one was made. */
  created: boolean;
}

export async function loadOrCreateStorageKey(db: Dexie, keyring: Keyring): Promise<LoadedKey> {
  const existing = await keyring.get(KEYRING_ID);
  if (existing) {
    // Retry once: a WebCrypto call can fail transiently, and giving up here
    // makes every row written with this key unreadable for good.
    const key = (await unsealKey(existing)) ?? (await unsealKey(existing));
    if (key) return { key, entry: existing, created: false };
    console.error('[secure-storage] stored key could not be opened; generating a new one');
  }

  // Sealing is async WebCrypto work, so it happens before the transaction.
  const key = new Uint8Array(generateStorageKey());
  const sealed = await sealKey(key);
  try {
    return await claimKey(db, keyring, existing, sealed, key);
  } catch (err) {
    if (!sealed.wrappingKey) throw err;
    // Some browsers can't structured-clone a CryptoKey into IndexedDB.
    warnRawKey();
    const fallback: KeyringEntry = { rawKey: toBase64(key), createdAt: sealed.createdAt };
    return claimKey(db, keyring, existing, fallback, key);
  }
}

let warnedRawKey = false;

function warnRawKey() {
  if (warnedRawKey) return;
  warnedRawKey = true;
  console.warn('[secure-storage] cannot seal the storage key here; it is stored unsealed next to the data');
}

/**
 * Stores `candidate` unless another tab got there first. IndexedDB runs
 * read-write transactions on the same store one after another, even across
 * tabs, so re-reading inside one means two tabs opening at once end up with a
 * single key instead of each overwriting the other's.
 *
 * If the other tab's key doesn't open here (after one retry), it is replaced
 * only by the same compare-and-write, so a key a third tab stored in the
 * meantime is kept and tried instead of being overwritten.
 */
const MAX_CLAIM_ATTEMPTS = 3;

async function claimKey(
  db: Dexie,
  keyring: Keyring,
  replacing: KeyringEntry | undefined,
  candidate: KeyringEntry,
  key: Uint8Array,
): Promise<LoadedKey> {
  let expected = replacing;
  for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
    const winner = await db.transaction('rw', keyring, async () => {
      const current = await keyring.get(KEYRING_ID);
      // Someone else stored or replaced the key since we looked: use theirs.
      if (current && current.createdAt !== expected?.createdAt) return current;
      await keyring.put(candidate, KEYRING_ID);
      return null;
    });
    if (!winner) return { key, entry: candidate, created: true };
    const theirs = (await unsealKey(winner)) ?? (await unsealKey(winner));
    if (theirs) return { key: theirs, entry: winner, created: false };
    expected = winner;
  }
  throw new StorageDecryptError('keyring');
}

async function sealKey(key: Uint8Array<ArrayBuffer>): Promise<KeyringEntry> {
  const createdAt = new Date().toISOString();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    warnRawKey();
    return { rawKey: toBase64(key), createdAt };
  }

  const wrappingKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const wrappedKey = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, key));
  return { wrappingKey, wrappedKey: toBase64(wrappedKey), iv: toBase64(iv), createdAt };
}

async function unsealKey(entry: KeyringEntry): Promise<Uint8Array | null> {
  try {
    if (entry.rawKey) {
      const raw = fromBase64(entry.rawKey);
      return raw.length === STORAGE_KEY_BYTES ? raw : null;
    }
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || !entry.wrappingKey || !entry.wrappedKey || !entry.iv) return null;
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: toBuffer(entry.iv) },
      entry.wrappingKey,
      toBuffer(entry.wrappedKey),
    );
    return plain.byteLength === STORAGE_KEY_BYTES ? new Uint8Array(plain) : null;
  } catch {
    return null;
  }
}

/**
 * Rewrites every row of every encrypted table once, so rows stored in plain
 * text by older builds end up encrypted.
 *
 * Works on the native object stores, below the encryption middleware, so each
 * row is handled on its own: plain values are encrypted, and a row that can't
 * be decrypted (its key was lost) is deleted on its own instead of taking the
 * whole table with it. Queued sync rows and other readable rows survive.
 * Every step inside a cursor callback is synchronous, so the native
 * transaction stays open and can't race a concurrent app write.
 */
export async function migrateToEncrypted(
  db: Dexie,
  keyring: Keyring,
  fieldsByTable: Readonly<Record<string, readonly string[]>>,
  key: Uint8Array,
): Promise<void> {
  const entry = await keyring.get(KEYRING_ID);
  if ((entry?.migratedVersion ?? 0) >= ENCRYPTION_MIGRATION_VERSION) return;

  const idb = db.backendDB();
  for (const [name, fields] of Object.entries(fieldsByTable)) {
    if (!idb.objectStoreNames.contains(name)) continue;
    const dropped = await rewriteStore(idb, name, fields, key);
    if (dropped > 0) console.error(`[secure-storage] dropped ${dropped} unreadable row(s) from "${name}"`);
  }

  await keyring.update(KEYRING_ID, { migratedVersion: ENCRYPTION_MIGRATION_VERSION });
}

function rewriteStore(idb: IDBDatabase, name: string, fields: readonly string[], key: Uint8Array): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(name, 'readwrite');
    let dropped = 0;
    const request = tx.objectStore(name).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const row = cursor.value as Record<string, unknown>;
      if (row && typeof row === 'object') {
        try {
          let changed = false;
          const copy = { ...row };
          for (const field of fields) {
            const context = `${name}.${field}`;
            const value = copy[field];
            if (isEncrypted(value)) {
              decryptValue(key, value, context);
            } else if (value != null) {
              copy[field] = encryptValue(key, value, context);
              changed = true;
            }
          }
          if (changed) cursor.update(copy);
        } catch (err) {
          if (!(err instanceof StorageDecryptError)) throw err;
          cursor.delete();
          dropped += 1;
        }
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve(dropped);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function toBuffer(encoded: string): Uint8Array<ArrayBuffer> {
  const bytes = fromBase64(encoded);
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}
