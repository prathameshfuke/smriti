import { authenticateRequest } from '@/lib/supabase/server-auth';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { verifyDeviceTrust, type DeviceTrustToken } from '@/lib/auth/deviceTrustServer';
import { isUILanguage } from '@/lib/i18n/languages';
import { isPushConfigured } from '@/lib/push/send';
import {
  deleteSubscriptionByEndpoint,
  getSubscriptionByEndpoint,
  upsertSubscription,
  type SubscriptionKind,
} from '@/lib/push/subscriptionStore';

/**
 * Registers or removes this browser's Web Push subscription.
 *
 * Two ways to prove who is calling, mirroring the rest of the API:
 *  - a caregiver's Supabase session (Bearer), for their own phone or for a
 *    patient's phone they are setting up;
 *  - the signed device-trust tokens a kiosk phone already holds (issued by
 *    /api/device-trust), for the patient phone that has no Supabase session.
 * With tokens the patients are taken from the verified tokens, never from
 * ids in the body.
 */

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const MAX_PATIENTS = 20;

interface Body {
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  kind?: unknown;
  patientIds?: unknown;
  deviceTrustTokens?: unknown;
  language?: unknown;
  timezone?: unknown;
  endpoint?: unknown;
}

const isKind = (v: unknown): v is SubscriptionKind => v === 'patient_device' || v === 'caregiver';
const json = (body: unknown, status = 200) => Response.json(body, { status });

function validTimezone(tz: unknown): string {
  if (typeof tz !== 'string' || tz.length > 64) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function validTokens(raw: unknown): DeviceTrustToken[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_PATIENTS).filter((t): t is DeviceTrustToken => verifyDeviceTrust(t as DeviceTrustToken));
}

async function readBody(request: Request): Promise<Body | null> {
  try {
    const body = (await request.json()) as Body;
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

/** The caregiver row behind a Supabase session, or null. */
async function callerCaregiverId(auth: NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>): Promise<string | null> {
  const { data } = await auth.supabase.from('caregivers').select('id').eq('auth_id', auth.userId).single();
  return (data as { id: string } | null)?.id ?? null;
}

export async function POST(request: Request) {
  if (!isPushConfigured()) return json({ error: 'push_not_configured' }, 503);

  const body = await readBody(request);
  if (!body) return json({ error: 'invalid_json' }, 400);

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const authKey = body.subscription?.keys?.auth;
  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    endpoint.length > 2048 ||
    typeof p256dh !== 'string' ||
    typeof authKey !== 'string' ||
    !p256dh ||
    !authKey ||
    p256dh.length > 256 ||
    authKey.length > 256
  ) {
    return json({ error: 'invalid_subscription' }, 400);
  }
  if (!isKind(body.kind)) return json({ error: 'invalid_kind' }, 400);
  const kind = body.kind;

  const language = typeof body.language === 'string' && isUILanguage(body.language) ? body.language : 'en';
  const timezone = validTimezone(body.timezone);
  const service = createServiceRoleClient();

  let caregiverId: string | null = null;
  let patientIds: string[] = [];

  const auth = await authenticateRequest(request);
  if (auth) {
    caregiverId = await callerCaregiverId(auth);
    if (!caregiverId) return json({ error: 'caregiver_not_found' }, 404);
    if (kind === 'patient_device') {
      const wanted = Array.isArray(body.patientIds)
        ? [...new Set(body.patientIds.filter((p): p is string => typeof p === 'string'))].slice(0, MAX_PATIENTS)
        : [];
      if (wanted.length === 0) return json({ error: 'missing_patient_ids' }, 400);
      const { data } = await auth.supabase.from('patients').select('id').in('id', wanted).eq('caregiver_id', caregiverId);
      const owned = new Set(((data ?? []) as Array<{ id: string }>).map((p) => p.id));
      if (wanted.some((id) => !owned.has(id))) return json({ error: 'patient_not_found' }, 403);
      patientIds = wanted;
    }
  } else {
    if (kind !== 'patient_device') return json({ error: 'unauthorized' }, 401);
    const tokens = validTokens(body.deviceTrustTokens);
    if (tokens.length === 0) return json({ error: 'unauthorized' }, 401);
    patientIds = [...new Set(tokens.map((t) => t.patientId))];
    const { data } = await service.from('patients').select('id, caregiver_id').in('id', patientIds);
    const rows = (data ?? []) as Array<{ id: string; caregiver_id: string }>;
    if (rows.length === 0) return json({ error: 'patient_not_found' }, 404);
    // A signed token for a patient that no longer exists is simply dropped.
    patientIds = rows.map((r) => r.id);
    // A shared phone can hold patients of different caregivers; the row is
    // owned by the first one, and reminders follow `patient_ids`.
    caregiverId = rows[0].caregiver_id;
  }

  // One row per browser (endpoint is unique), so a caregiver-alerts phone and a
  // patient-reminders phone cannot be the same browser: switching kinds in
  // place would silently stop the other feature. Turn the old one off first.
  const prior = await getSubscriptionByEndpoint(service, endpoint);
  if (prior && prior.kind !== kind) return json({ error: 'endpoint_in_use', existingKind: prior.kind }, 409);

  const { error } = await upsertSubscription(service, {
    endpoint,
    p256dh,
    auth: authKey,
    kind,
    caregiverId,
    patientIds,
    language,
    timezone,
  });
  if (error) return json({ error: 'store_failed' }, 500);
  return json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await readBody(request);
  if (!body || typeof body.endpoint !== 'string') return json({ error: 'invalid_request' }, 400);
  const service = createServiceRoleClient();
  const row = await getSubscriptionByEndpoint(service, body.endpoint);
  if (!row) return json({ ok: true });

  let allowed = false;
  const auth = await authenticateRequest(request);
  if (auth) {
    allowed = (await callerCaregiverId(auth)) === row.caregiverId;
  } else {
    const covered = new Set(validTokens(body.deviceTrustTokens).map((t) => t.patientId));
    allowed = row.patientIds.some((id) => covered.has(id));
  }
  if (!allowed) return json({ error: 'unauthorized' }, 401);

  await deleteSubscriptionByEndpoint(service, body.endpoint);
  return json({ ok: true });
}
