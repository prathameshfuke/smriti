import type Dexie from 'dexie';
import type { IndexableTypeArrayReadonly, Table } from 'dexie';
import { fromBase64, generateStorageKey, StorageDecryptError, STORAGE_KEY_BYTES, toBase64 } from './cipher';

/**
 * The one row of the `keyring` table.
 *
 * The data key that encrypts fields is never stored as-is when WebCrypto is
 * available: it is sealed with a non-extractable AES-GCM `CryptoKey`, which
 * IndexedDB can store but page script can never export. `rawKey` is only used
 * where that isn't possible (no `crypto.subtle` outside a secure context, or a
 * browser that refuses to store CryptoKey objects).
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

export async function loadOrCreateStorageKey(keyring: Keyring): Promise<LoadedKey> {
  const entry = await keyring.get(KEYRING_ID);
  if (entry) {
    const key = await unsealKey(entry);
    if (key) return { key, entry, created: false };
    console.error('[secure-storage] stored key could not be opened; generating a new one');
  }

  const key = new Uint8Array(generateStorageKey());
  const fresh = await sealKey(key);
  try {
    await keyring.put(fresh, KEYRING_ID);
    return { key, entry: fresh, created: true };
  } catch (err) {
    if (!fresh.wrappingKey) throw err;
    // Some browsers can't structured-clone a CryptoKey into IndexedDB.
    const fallback: KeyringEntry = { rawKey: toBase64(key), createdAt: fresh.createdAt };
    await keyring.put(fallback, KEYRING_ID);
    return { key, entry: fallback, created: true };
  }
}

async function sealKey(key: Uint8Array<ArrayBuffer>): Promise<KeyringEntry> {
  const createdAt = new Date().toISOString();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { rawKey: toBase64(key), createdAt };

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
 * text by older builds end up encrypted. Each table is read and written back
 * in one transaction with no async work in between, so it can't race a
 * concurrent app write.
 *
 * A table whose rows can't be decrypted (the key was lost, e.g. its row was
 * removed on its own) is cleared rather than left to fail every future read.
 * Everything in it is either re-pulled from the server or a regenerable cache;
 * rows still waiting to sync are the one real loss, and there is no way to
 * read them without the old key anyway.
 */
export async function migrateToEncrypted(
  db: Dexie,
  keyring: Keyring,
  tableNames: readonly string[],
): Promise<void> {
  const entry = await keyring.get(KEYRING_ID);
  if ((entry?.migratedVersion ?? 0) >= ENCRYPTION_MIGRATION_VERSION) return;

  for (const name of tableNames) {
    const table = db.table(name);
    const outbound = !table.schema.primKey.keyPath;
    try {
      await db.transaction('rw', table, async () => {
        const rows = await table.toArray();
        if (rows.length === 0) return;
        if (outbound) {
          const keys = await table.toCollection().primaryKeys();
          await table.bulkPut(rows, keys as IndexableTypeArrayReadonly);
        } else {
          await table.bulkPut(rows);
        }
      });
    } catch (err) {
      if (!isDecryptFailure(err)) throw err;
      console.error(`[secure-storage] clearing unreadable local table "${name}"`);
      await table.clear();
    }
  }

  await keyring.update(KEYRING_ID, { migratedVersion: ENCRYPTION_MIGRATION_VERSION });
}

function toBuffer(encoded: string): Uint8Array<ArrayBuffer> {
  const bytes = fromBase64(encoded);
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

function isDecryptFailure(err: unknown): boolean {
  if (err instanceof StorageDecryptError) return true;
  const inner = (err as { inner?: unknown } | null)?.inner;
  return inner instanceof StorageDecryptError;
}
