/**
 * Browser side of caregiver alert notifications: subscribe this browser as
 * `kind: "caregiver"` and turn it off again. Every layer is feature-detected;
 * nothing here throws to the caller.
 */

import { authedFetch } from '@/lib/api/client';
import { getNotifySupport, notificationPermission, urlBase64ToUint8Array } from './client';

export type AlertsState = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';
export type AlertsChange = 'ok' | 'not_configured' | 'in_use' | 'blocked' | 'unsupported' | 'failed';

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null;
  try {
    return (
      (await navigator.serviceWorker.getRegistration()) ??
      (await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 3000))]))
    );
  } catch {
    return null;
  }
}

/** What the settings card should show right now. */
export async function getAlertsState(): Promise<AlertsState> {
  const support = getNotifySupport();
  if (support === 'unsupported') return 'unsupported';
  if (support === 'needs-install') return 'needs-install';
  const permission = notificationPermission();
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'off';
  const sub = await (await registration())?.pushManager?.getSubscription().catch(() => null);
  return sub ? 'on' : 'off';
}

/** Must run from a tap (iOS needs a gesture for the permission prompt). */
export async function enableCaregiverAlerts(language: string): Promise<AlertsChange> {
  if (notificationPermission() === 'unsupported') return 'unsupported';
  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = Notification.permission;
    }
  }
  if (permission !== 'granted') return 'blocked';

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return 'not_configured';
  const reg = await registration();
  if (!reg?.pushManager) return 'unsupported';
  try {
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const json = subscription.toJSON();
    await authedFetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        subscription: { endpoint: json.endpoint, keys: json.keys },
        kind: 'caregiver',
        language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    return 'ok';
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('status 409')) return 'in_use';
    if (message.includes('status 503')) return 'not_configured';
    return 'failed';
  }
}

/** Removes the server row first, then the browser subscription. */
export async function disableCaregiverAlerts(): Promise<AlertsChange> {
  try {
    const reg = await registration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return 'ok';
    await authedFetch('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe().catch(() => false);
    return 'ok';
  } catch {
    return 'failed';
  }
}
