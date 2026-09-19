import {
  handleNotificationClick,
  notifyDueFromLocalDb,
  PERIODIC_SYNC_TAG,
  showPushNotification,
  type PushPayload,
} from './handlers';

/**
 * Custom service-worker code. next-pwa (customWorkerDir: 'sw') bundles this to
 * `public/worker-<hash>.js` and importScripts it into the generated `sw.js`,
 * so it runs alongside Workbox's precaching, not instead of it.
 *
 * Three ways a reminder can reach a phone whose app is closed:
 *  - `push`: the server tick sent it (needs Web Push configured).
 *  - `periodicsync`: the browser woke the worker (installed Chromium PWAs
 *    only, throttled) and it read the due reminders from IndexedDB, offline.
 *  - the open page's own poll (useReminders), unchanged.
 * All three share one claim store, so an occurrence is notified once.
 */

interface PushEventLike {
  data: { json(): unknown; text(): string } | null;
  waitUntil(p: Promise<unknown>): void;
}
interface WorkerScope {
  registration: { showNotification(title: string, options?: NotificationOptions): Promise<void> };
  clients: Parameters<typeof handleNotificationClick>[1];
  location: { origin: string };
  addEventListener(type: string, listener: (event: never) => void): void;
}

const sw = self as unknown as WorkerScope;

sw.addEventListener('push', ((event: PushEventLike) => {
  let payload: PushPayload | null = null;
  try {
    payload = (event.data?.json() as PushPayload | undefined) ?? null;
  } catch {
    payload = event.data ? { body: event.data.text() } : null;
  }
  event.waitUntil(showPushNotification(sw.registration, payload));
}) as (event: never) => void);

sw.addEventListener('notificationclick', ((event: {
  notification: { close(): void; data?: { url?: unknown } };
  waitUntil(p: Promise<unknown>): void;
}) => {
  event.waitUntil(handleNotificationClick(event.notification, sw.clients, sw.location.origin));
}) as (event: never) => void);

sw.addEventListener('periodicsync', ((event: { tag: string; waitUntil(p: Promise<unknown>): void }) => {
  if (event.tag !== PERIODIC_SYNC_TAG) return;
  event.waitUntil(notifyDueFromLocalDb(sw.registration).catch(() => 0));
}) as (event: never) => void);
