import { computeDueReminders, localDate, occurrenceKey, type DueReminder, type DueSchedule } from '../lib/engine/dueCore';
import { claimNotification, pruneClaims, readNotifyPrefs, unclaimNotification } from '../lib/push/notifyStore';
import { PERIODIC_SYNC_TAG, REMINDER_TAG_PREFIX, reminderBody } from '../lib/push/reminderText';
import { readReminderRows, writeReminderAck } from './localDb';

/**
 * Service-worker logic, kept free of `self` so it can be unit tested. The
 * event wiring is in `index.ts`. Relative imports only (see localDb.ts).
 */

export { PERIODIC_SYNC_TAG, REMINDER_TAG_PREFIX };
const ICON = '/icons/icon-192.png';
const DEFAULT_TITLE = 'SMRITI';
const DEFAULT_URL = '/app';

/** `actions` is part of the service-worker Notifications API but missing from
 * lib.dom's `NotificationOptions` (that's the page-context type); widened
 * here rather than pulling in the whole `webworker` lib. */
export interface NotificationOptionsWithActions extends NotificationOptions {
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

export interface NotifyRegistration {
  showNotification(title: string, options?: NotificationOptionsWithActions): Promise<void>;
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
    const doneLabel = prefs?.strings?.done || 'Done';
    const laterLabel = prefs?.strings?.snooze || 'Later';
    await reg.showNotification(prefs?.title || DEFAULT_TITLE, {
      body: reminderBody(d, prefs?.strings),
      tag: `${REMINDER_TAG_PREFIX}${key}`,
      icon: ICON,
      badge: ICON,
      // Snooze/acknowledge right on the notification (handleNotificationClick
      // below) — an elderly patient never has to unlock and open the app for
      // the common case. `actions` needs Chromium; browsers without it just
      // show the notification with no buttons, tapping the body still works.
      actions: [
        { action: 'ack', title: doneLabel },
        { action: 'snooze', title: laterLabel },
      ],
      data: { url: DEFAULT_URL, reminderId: d.schedule.id, patientId: d.schedule.patientId, scheduledAt: scheduledAtFor(d, now), occurrenceKey: key },
    });
    shown += 1;
  }
  await pruneClaims().catch(() => undefined);
  return shown;
}

/** Same `reminderId:date` occurrence-scoping `acknowledgeReminder` (lib/engine/reminders.ts)
 * uses, computed here since the worker never imports that Dexie-backed module. */
function scheduledAtFor(d: DueReminder<DueSchedule>, now: Date): string {
  if (d.occurrence) return `${d.occurrence.date}T${d.occurrence.time}:00.000Z`;
  return `${localDate(now)}T${d.schedule.timeOfDay}:00.000Z`;
}

/**
 * The "Done" notification action: writes the ack directly to IndexedDB, no
 * app window needed. `ackMethod: 'touch'` — a notification tap is the same
 * input class as tapping the in-app card.
 */
async function acknowledgeFromNotification(data: { reminderId?: unknown; patientId?: unknown; scheduledAt?: unknown }): Promise<boolean> {
  const { reminderId, patientId, scheduledAt } = data;
  if (typeof reminderId !== 'string' || typeof patientId !== 'string' || typeof scheduledAt !== 'string') return false;
  const written = await writeReminderAck({
    id: crypto.randomUUID(),
    reminderId,
    patientId,
    scheduledAt,
    acknowledgedAt: new Date().toISOString(),
    ackMethod: 'touch',
    synced: false,
  });
  // No window is open to show a retry, and the notification is already
  // closed by the time this runs — so the one thing a failed write can still
  // do is stay loud in the worker's own console instead of vanishing
  // silently. It isn't a stuck acknowledgment either way: with no ack row
  // written, computeDueReminders (dueCore.ts) still counts this occurrence
  // as due, so it surfaces again on the next check rather than being lost.
  if (!written) console.error('SMRITI: notification "Done" tap failed to write locally', reminderId);
  return written;
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

/**
 * Brings an open SMRITI window forward, or opens one at the notification's
 * path — for a plain tap on the notification body (`action` is `''`/undefined).
 *
 * `action === 'ack'` or `'snooze'` (the two buttons on a reminder
 * notification, see `notifyDueFromLocalDb` above) are handled entirely here,
 * offline, with no window opened: the whole point of putting them on the
 * notification is that an elderly patient never has to unlock the phone and
 * find the app just to say "done" or "not now".
 */
export async function handleNotificationClick(
  notification: { close(): void; data?: { url?: unknown; reminderId?: unknown; patientId?: unknown; scheduledAt?: unknown; occurrenceKey?: unknown } },
  clients: ClientsLike,
  origin: string,
  action?: string,
): Promise<void> {
  notification.close();

  if (action === 'ack') {
    const written = await acknowledgeFromNotification(notification.data ?? {});
    // A failed write leaves nothing recorded, so the occurrence must not stay
    // claimed either — otherwise it never re-shows, and "Done" quietly did
    // nothing instead of the reminder self-healing on the next due-check.
    if (!written) {
      const key = notification.data?.occurrenceKey;
      if (typeof key === 'string') await unclaimNotification(key).catch(() => undefined);
    }
    return;
  }
  if (action === 'snooze') {
    const key = notification.data?.occurrenceKey;
    if (typeof key === 'string') await unclaimNotification(key).catch(() => undefined);
    return;
  }

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
