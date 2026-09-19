import { db } from '@/lib/db/schema';
import { fromBase64, toBase64 } from '@/lib/db/crypto/cipher';
import { createBrowserClient } from '@/lib/supabase/client';
import { createCloudKey, unwrapCloudKey, type WrappedCloudKey } from './cloudCrypto';

/**
 * Where the Memory Bank cloud key lives:
 *
 * - Supabase `memory_bank_keys`: only the passphrase-wrapped key, one row per
 *   caregiver, readable and writable by that caregiver alone (RLS).
 * - This phone: the unwrapped key in `db.cloudKeys`, itself encrypted at rest
 *   by the device storage key (db/crypto), so sync keeps working offline and
 *   after restarts without asking for the passphrase again.
 *
 * Nothing here is ever required for the Memory Bank to work on the phone.
 * Without a key, entries simply stay local and unsynced; they are never sent
 * in plain text.
 */

export type CloudKeyStatus =
  /** Unlocked on this phone; sync runs. */
  | 'ready'
  /** The account has a key, but this phone needs the passphrase once. */
  | 'locked'
  /** No backup passphrase set for this account yet. */
  | 'not_set_up'
  /** Couldn't check (offline, no session). */
  | 'unknown';

export async function getLocalCloudKey(caregiverId: string): Promise<Uint8Array | null> {
  try {
    const row = await db.cloudKeys.get(caregiverId);
    return row ? fromBase64(row.key) : null;
  } catch {
    return null;
  }
}

async function saveLocalCloudKey(caregiverId: string, key: Uint8Array): Promise<void> {
  await db.cloudKeys.put({ key: toBase64(key), savedAt: new Date().toISOString() }, caregiverId);
}

const LOOKUP_TIMEOUT_MS = 8_000;

async function fetchWrappedKey(caregiverId: string): Promise<WrappedCloudKey | null> {
  const { data, error } = await createBrowserClient()
    .from('memory_bank_keys')
    .select('wrapped_key, salt, kdf, kdf_iterations')
    .eq('caregiver_id', caregiverId)
    // A connection with no signal behind it can hang; the backup panel then
    // says "offline" instead of waiting.
    .abortSignal(AbortSignal.timeout(LOOKUP_TIMEOUT_MS))
    .maybeSingle();
  if (error) throw error;
  return data as WrappedCloudKey | null;
}

export async function getCloudKeyStatus(caregiverId: string): Promise<CloudKeyStatus> {
  if (await getLocalCloudKey(caregiverId)) return 'ready';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'unknown';
  try {
    return (await fetchWrappedKey(caregiverId)) ? 'locked' : 'not_set_up';
  } catch {
    return 'unknown';
  }
}

/**
 * First-time setup for the account. Refuses if a key already exists on the
 * server (another phone set one up), so two phones can never end up with
 * different keys: `unlockCloudKey` is the path for that case.
 */
export async function setUpCloudKey(caregiverId: string, passphrase: string): Promise<void> {
  const { key, wrapped } = await createCloudKey(passphrase);
  const { error } = await createBrowserClient()
    .from('memory_bank_keys')
    .insert({ caregiver_id: caregiverId, ...wrapped } as never);
  if (error) throw error;
  await saveLocalCloudKey(caregiverId, key);
  await markAllMemoryBankUnsynced();
}

/** Unlocks the account's existing key on this phone. Throws WrongPassphraseError. */
export async function unlockCloudKey(caregiverId: string, passphrase: string): Promise<void> {
  const wrapped = await fetchWrappedKey(caregiverId);
  if (!wrapped) throw new Error('no_key');
  const key = await unwrapCloudKey(passphrase, wrapped);
  await saveLocalCloudKey(caregiverId, key);
  await markAllMemoryBankUnsynced();
}

/**
 * Re-sends every local entry once a key is available (entries edited before
 * backup was set up were held back, and rows an older build uploaded in plain
 * text get overwritten with ciphertext), and pulls everything again.
 */
async function markAllMemoryBankUnsynced(): Promise<void> {
  await db.memoryBankEntries.toCollection().modify({ synced: false });
  // Rows pulled while this phone had no key were skipped; pull everything again.
  await db.syncCursors.clear();
}
