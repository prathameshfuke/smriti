import { computeDueReminders, occurrenceKey } from '../lib/engine/dueCore';
import { claimNotification, pruneClaims, readNotifyPrefs } from '../lib/push/notifyStore';
import { PERIODIC_SYNC_TAG, REMINDER_TAG_PREFIX, reminderBody } from '../lib/push/reminderText';
import { readReminderRows } from './localDb';

/**
 * Service-worker logic, kept free of `self` so it can be unit tested. The
 * event wiring is in `index.ts`. Relative imports only (see localDb.ts).
 */

export { PERIODIC_SYNC_TAG, REMINDER_TAG_PREFIX };
const ICON = '/icons/icon-192.png';
const DEFAULT_TITLE = 'SMRITI';
const DEFAULT_URL = '/app';

export interface NotifyRegistration {
  showNotification(title: string, options?: NotificationOptions): Promise<void>;
}

export interface PushPayload {
  title?: string;
  body?: string;
  /** Same tag = replaces the earlier notification instead of stacking. */
  tag?: string;
  url?: string;
}

/**
 * Shows a server push. Browsers require every push to end in a visible
 * notification, so an empty or unreadable payload still shows a generic one.
 */
export async function showPushNotification(reg: NotifyRegistration, payload: PushPayload | null): Promise<void> {
  const p = payload ?? {};
  await reg.showNotification(p.title || DEFAULT_TITLE, {
    body: p.body || '',
    tag: p.tag,
    icon: ICON,
    badge: ICON,
    data: { url: safeClickUrl(p.url) },
  });
}

/**
 * Offline check: reads the reminders straight from IndexedDB and shows the
 * ones that are due and not yet notified. No network. Returns how many it showed.
 *
 * A wider look-back than the open app's (10 vs 2 minutes) because a
 * background wake-up is late and irregular; the claim store (notifyStore.ts)
 * is what stops repeats, so wider is safe.
 */
export async function notifyDueFromLocalDb(reg: NotifyRegistration, now: Date = new Date()): Promise<number> {
  const rows = await readReminderRows();
  if (!rows) return 0;
  const due = computeDueReminders(rows.schedules, rows.acks, now, { lookbackMinutes: 10, lookaheadMinutes: 0 });
  if (due.length === 0) return 0;

  const prefs = await readNotifyPrefs().catch(() => null);
  let shown = 0;
  for (const d of due) {
    const key = occurrenceKey(d, now);
    if (!(await claimNotification(key))) continue;
    await reg.showNotification(prefs?.title || DEFAULT_TITLE, {
      body: reminderBody(d, prefs?.strings),
      tag: `${REMINDER_TAG_PREFIX}${key}`,
      icon: ICON,
      badge: ICON,
      data: { url: DEFAULT_URL },
    });
    shown += 1;
  }
  await pruneClaims().catch(() => undefined);
  return shown;
}

/** Same-origin path only. Anything else falls back to the home screen. */
export function safeClickUrl(url: unknown): string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : DEFAULT_URL;
}

interface ClientLike {
  url: string;
  focus(): Promise<unknown>;
  /** Not on every browser; optional on purpose. */
  navigate?(url: string): Promise<unknown>;
}

export interface ClientsLike {
  matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<ClientLike[]>;
  openWindow(url: string): Promise<unknown>;
}

/** Brings an open SMRITI window forward, or opens one at the notification's path. */
export async function handleNotificationClick(
  notification: { close(): void; data?: { url?: unknown } },
  clients: ClientsLike,
  origin: string,
): Promise<void> {
  notification.close();
  const path = safeClickUrl(notification.data?.url);
  const open = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = open.find((c) => c.url.startsWith(origin));
  if (existing) {
    await existing.focus();
    // A specific target (an alert's patient page) must not be lost just
    // because SMRITI is already open. The plain home target keeps its old behaviour.
    if (path !== DEFAULT_URL && existing.navigate) await existing.navigate(`${origin}${path}`).catch(() => undefined);
    return;
  }
  await clients.openWindow(`${origin}${path}`);
}
