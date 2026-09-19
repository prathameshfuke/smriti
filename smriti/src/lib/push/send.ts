/**
 * Server-side Web Push delivery.
 *
 * ============================ STABLE CONTRACT ============================
 * Other workstreams (alert delivery) import from here. Do not change these
 * signatures without updating them.
 *
 *   sendPushToCaregiver(
 *     supabase: PushDb,          // a service-role Supabase client
 *     caregiverId: string,       // caregivers.id (not the auth user id)
 *     payload: PushPayload,      // { title, body, tag?, url? }
 *   ): Promise<PushSendResult>   // never rejects
 *
 *   PushPayload    { title: string; body: string; tag?: string; url?: string }
 *                  `url` must be a same-origin path ("/caregiver/alerts");
 *                  anything else opens "/app". `tag` replaces an earlier
 *                  notification with the same tag instead of stacking.
 *   PushSendResult { attempted, sent, removed, failed, skipped? }
 *                  `skipped: 'not_configured'` when the VAPID variables are
 *                  unset: the call is then a harmless no-op.
 *
 * Reaches only subscriptions with kind = 'caregiver' registered by that
 * caregiver (POST /api/push/subscribe with kind "caregiver"). Subscriptions
 * the push service reports gone (404/410) are deleted.
 *
 * Also exported: isPushConfigured(), sendPushToSubscription(). Storage lives
 * in ./subscriptionStore.ts.
 * ========================================================================
 *
 * Inert unless NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and
 * VAPID_SUBJECT (a mailto: or https: URL) are all set. `web-push` is loaded on
 * first use, so a deployment without the variables never touches it.
 */

import {
  deleteSubscriptionById,
  listCaregiverSubscriptions,
  type PushDb,
  type StoredSubscription,
} from './subscriptionStore';

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export interface PushSendResult {
  attempted: number;
  sent: number;
  removed: number;
  failed: number;
  skipped?: 'not_configured';
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
  );
}

async function loadWebPush() {
  const mod = await import('web-push');
  const webpush = mod.default ?? mod;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  return webpush;
}

/** One push. `gone` means the browser dropped the subscription for good. */
export async function sendPushToSubscription(
  sub: Pick<StoredSubscription, 'endpoint' | 'p256dh' | 'auth'>,
  payload: PushPayload,
): Promise<'ok' | 'gone' | 'failed'> {
  if (!isPushConfigured()) return 'failed';
  try {
    const webpush = await loadWebPush();
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 },
    );
    return 'ok';
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? 'gone' : 'failed';
  }
}

export async function sendPushToCaregiver(
  supabase: PushDb,
  caregiverId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  const result: PushSendResult = { attempted: 0, sent: 0, removed: 0, failed: 0 };
  if (!isPushConfigured()) return { ...result, skipped: 'not_configured' };

  let subs: StoredSubscription[];
  try {
    subs = await listCaregiverSubscriptions(supabase, caregiverId);
  } catch {
    return result;
  }

  for (const sub of subs) {
    result.attempted += 1;
    const outcome = await sendPushToSubscription(sub, payload);
    if (outcome === 'ok') result.sent += 1;
    else if (outcome === 'gone') {
      result.removed += 1;
      await deleteSubscriptionById(supabase, sub.id).catch(() => undefined);
    } else result.failed += 1;
  }
  return result;
}
