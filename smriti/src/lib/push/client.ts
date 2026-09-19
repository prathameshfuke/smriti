/**
 * Browser side of reminder notifications: permission, the notification
 * itself, periodic background sync, and the Web Push subscription.
 *
 * Every layer is feature-detected and best effort. Turning notifications on
 * always gives at least the in-app behaviour; periodic sync and Web Push are
 * added when the browser and the server allow, and a failure in either never
 * surfaces as an error to the person using the app.
 *
 * What each layer can and cannot do is spelled out in docs/ (and the PR):
 * there is no reliable way on the web to fire a local alarm while the app is
 * closed and offline. Web Push covers "closed, online"; periodic sync covers
 * "closed, offline" only on installed Chromium apps, at the browser's pace.
 */

import { claimNotification, writeNotifyPrefs } from './notifyStore';
import { PERIODIC_SYNC_TAG, REMINDER_TAG_PREFIX } from './reminderText';
import { authedFetch } from '@/lib/api/client';
import type { DeviceTrustToken } from '@/lib/db/schema';

const ICON = '/icons/icon-192.png';
/** Chromium clamps this to its own minimum (about 12 hours for a typical
 * install, more for a rarely used one); asking for less is harmless. */
const PERIODIC_MIN_INTERVAL_MS = 15 * 60 * 1000;
const SW_READY_TIMEOUT_MS = 3000;

export type NotifySupport = 'unsupported' | 'needs-install' | 'ready';
export type PushOutcome = 'subscribed' | 'not_configured' | 'unsupported' | 'failed';

export interface EnableInput {
  /** Notification title, translated. */
  title: string;
  /** Generic translated phrases per reminder type, for the service worker. */
  strings: Record<string, string>;
  language: string;
  patientIds: string[];
  deviceTrustTokens: DeviceTrustToken[];
}

export interface EnableResult {
  permission: NotificationPermission | 'unsupported';
  push: PushOutcome;
  /** True when periodic background sync was registered for offline delivery. */
  periodicSync: boolean;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/**
 * iPhones and iPads only deliver notifications to a web app that has been
 * added to the Home Screen (iOS 16.4+), so a Safari tab must install first.
 */
export function getNotifySupport(): NotifySupport {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (typeof navigator === 'undefined') return 'ready';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone ? 'needs-install' : 'ready';
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** The active service worker registration, or null (dev builds have none). */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

/**
 * The open app's system notification for one reminder occurrence.
 *
 * Claims the occurrence first (shared with the service worker and Web Push),
 * so whichever gets there first notifies and the others stay quiet. The tag
 * is the same in all three, so even a race shows a single notification.
 * Goes through the service worker registration when there is one, so tapping
 * it is handled by the worker's `notificationclick` like the others.
 */
export async function showReminderNotification(
  key: string,
  title: string,
  body: string,
): Promise<'shown' | 'duplicate' | 'unavailable'> {
  if (notificationPermission() !== 'granted') return 'unavailable';
  try {
    if (!(await claimNotification(key))) return 'duplicate';
  } catch {
    // No IndexedDB (private mode): fall through and notify without dedupe.
  }
  const options: NotificationOptions = { body, icon: ICON, badge: ICON, tag: `${REMINDER_TAG_PREFIX}${key}`, data: { url: '/app' } };
  try {
    const reg = await getRegistration();
    if (reg?.showNotification) await reg.showNotification(title, options);
    else new Notification(title, options);
    return 'shown';
  } catch {
    return 'unavailable';
  }
}

async function registerPeriodicSync(reg: ServiceWorkerRegistration): Promise<boolean> {
  const periodic = (reg as ServiceWorkerRegistration & {
    periodicSync?: { register(tag: string, options: { minInterval: number }): Promise<void> };
  }).periodicSync;
  if (!periodic) return false;
  try {
    const status = await navigator.permissions?.query({ name: 'periodic-background-sync' as PermissionName });
    if (status && status.state !== 'granted') return false;
    await periodic.register(PERIODIC_SYNC_TAG, { minInterval: PERIODIC_MIN_INTERVAL_MS });
    return true;
  } catch {
    return false;
  }
}

async function subscribeToPush(reg: ServiceWorkerRegistration, input: EnableInput): Promise<PushOutcome> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return 'not_configured';
  if (!reg.pushManager) return 'unsupported';
  try {
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const json = subscription.toJSON();
    const body = JSON.stringify({
      subscription: { endpoint: json.endpoint, keys: json.keys },
      kind: 'patient_device',
      language: input.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      patientIds: input.patientIds,
      deviceTrustTokens: input.deviceTrustTokens,
    });
    if (input.deviceTrustTokens.length > 0) {
      // A kiosk phone has no Supabase session: its signed tokens are the proof.
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      return res.ok ? 'subscribed' : 'failed';
    }
    await authedFetch('/api/push/subscribe', { method: 'POST', body });
    return 'subscribed';
  } catch {
    return 'failed';
  }
}

/**
 * The opt-in. Must be called from a tap (iOS refuses a permission prompt
 * that no gesture asked for). Asks for permission, stores the wording for
 * the worker, then adds periodic sync and Web Push where available.
 */
export async function enableReminderNotifications(input: EnableInput): Promise<EnableResult> {
  const supported = notificationPermission();
  if (supported === 'unsupported') return { permission: 'unsupported', push: 'unsupported', periodicSync: false };

  let permission: NotificationPermission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = Notification.permission;
    }
  }
  if (permission !== 'granted') return { permission, push: 'unsupported', periodicSync: false };

  await writeNotifyPrefs({ language: input.language, title: input.title, strings: input.strings }).catch(() => undefined);

  const reg = await getRegistration();
  if (!reg) return { permission, push: 'unsupported', periodicSync: false };
  const [periodicSync, push] = await Promise.all([registerPeriodicSync(reg), subscribeToPush(reg, input)]);
  return { permission, push, periodicSync };
}

/** Keeps the worker's wording in step when the language changes. Cheap and safe to call often. */
export async function refreshNotifyPrefs(prefs: { language: string; title: string; strings: Record<string, string> }): Promise<void> {
  if (notificationPermission() !== 'granted') return;
  await writeNotifyPrefs(prefs).catch(() => undefined);
}
