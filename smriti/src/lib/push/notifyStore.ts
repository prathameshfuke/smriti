/**
 * A tiny IndexedDB database shared by the page and the service worker.
 *
 * Two jobs:
 *  - `claims`: which reminder occurrences already produced a system
 *    notification, so the in-app poll, the service worker's periodic sync and
 *    a server push never notify the same occurrence twice.
 *  - `prefs`: the language and the generic notification wording. The service
 *    worker has no i18n provider and no access to the encrypted local data
 *    (and a lock-screen notification should not name a medicine anyway), so
 *    the page stores the translated generic phrases here for the worker.
 *
 * Deliberately a separate database from `smriti` (Dexie): the worker must not
 * touch Dexie's schema versions, and nothing here is personal data.
 * Relative imports only: it is bundled into the service worker.
 */

export const NOTIFY_DB = 'smriti-notify';
const CLAIMS = 'claims';
const PREFS = 'prefs';
const PREFS_KEY = 'prefs';
const CLAIM_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export interface NotifyPrefs {
  language: string;
  title: string;
  /** Keyed by reminder type (`medication`, ...) and the two appointment prompts
   * (`appointmentTomorrow`, `appointmentToday`, with a `{time}` placeholder). */
  strings: Record<string, string>;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOTIFY_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CLAIMS)) db.createObjectStore(CLAIMS);
      if (!db.objectStoreNames.contains(PREFS)) db.createObjectStore(PREFS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Records that `key` is being notified. True for the first caller only. The
 * read and the write share one read-write transaction, which IndexedDB runs
 * one at a time even across the page and the worker, so it is atomic.
 */
export async function claimNotification(key: string, at: number = Date.now()): Promise<boolean> {
  const db = await open();
  try {
    const tx = db.transaction(CLAIMS, 'readwrite');
    const store = tx.objectStore(CLAIMS);
    let first = false;
    const get = store.get(key);
    get.onsuccess = () => {
      if (get.result === undefined) {
        first = true;
        store.put(at, key);
      }
    };
    await done(tx);
    return first;
  } finally {
    db.close();
  }
}

/**
 * Forgets one occurrence's claim — the "Later" action on a reminder
 * notification (sw/handlers.ts). Matches the in-app Snooze card exactly
 * (ReminderCard's own doc comment: it only dismisses, the reminder stays
 * unacknowledged): there is no reliable way to fire a delayed re-notification
 * from a service worker, so "snooze" means "stop claiming this occurrence,
 * so it counts as still-due again" rather than a guaranteed timer.
 */
export async function unclaimNotification(key: string): Promise<void> {
  const db = await open();
  try {
    const tx = db.transaction(CLAIMS, 'readwrite');
    tx.objectStore(CLAIMS).delete(key);
    await done(tx);
  } finally {
    db.close();
  }
}

/** Forgets claims older than three days. */
export async function pruneClaims(now: number = Date.now()): Promise<void> {
  const db = await open();
  try {
    const tx = db.transaction(CLAIMS, 'readwrite');
    const store = tx.objectStore(CLAIMS);
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c) return;
      if (now - Number(c.value) > CLAIM_MAX_AGE_MS) c.delete();
      c.continue();
    };
    await done(tx);
  } finally {
    db.close();
  }
}

export async function writeNotifyPrefs(prefs: NotifyPrefs): Promise<void> {
  const db = await open();
  try {
    const tx = db.transaction(PREFS, 'readwrite');
    tx.objectStore(PREFS).put(prefs, PREFS_KEY);
    await done(tx);
  } finally {
    db.close();
  }
}

export async function readNotifyPrefs(): Promise<NotifyPrefs | null> {
  const db = await open();
  try {
    const tx = db.transaction(PREFS, 'readonly');
    const req = tx.objectStore(PREFS).get(PREFS_KEY);
    await done(tx);
    return (req.result as NotifyPrefs | undefined) ?? null;
  } finally {
    db.close();
  }
}
