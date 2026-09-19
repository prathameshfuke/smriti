import type { DueAck, DueSchedule } from '../lib/engine/dueCore';

/**
 * Reads the app's Dexie database (`smriti`) without Dexie: plain IndexedDB, so
 * the worker stays small and can never alter Dexie's schema versions.
 *
 * Only unencrypted fields are read. `ENCRYPTED_FIELDS` (lib/db/crypto/fields.ts)
 * covers `label`, `facilityName`, `locationNotes`, `bringNotes` on reminder
 * schedules; everything due-ness needs is stored as plain values, so the worker
 * needs no key. Relative imports only: bundled by next-pwa's own webpack step.
 */

const DB_NAME = 'smriti';

/** Opens the database only if it already exists; never creates an empty one. */
function openExisting(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME);
    // An upgrade here means the database did not exist (no version was
    // requested, so an existing one never upgrades). Abort so no empty
    // database is created for Dexie to trip over; the abort surfaces as `error`.
    req.onupgradeneeded = () => req.transaction?.abort();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(store)) return resolve([]);
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => resolve([]);
  });
}

export async function readReminderRows(): Promise<{ schedules: DueSchedule[]; acks: DueAck[] } | null> {
  const db = await openExisting();
  if (!db) return null;
  try {
    const [schedules, acks] = await Promise.all([
      getAll<DueSchedule>(db, 'reminderSchedules'),
      getAll<DueAck>(db, 'reminderAcks'),
    ]);
    return { schedules, acks };
  } finally {
    db.close();
  }
}
