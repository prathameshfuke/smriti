/**
 * Storage helper for the `push_subscriptions` table (MIGRATION 016 in
 * docs/03_DATABASE.md). Server-only. Takes the Supabase client as an
 * argument: use a service-role client, since a kiosk phone has no Supabase
 * session for RLS to key off (its caller has already authorised the request).
 */

/** Just the part of a Supabase client the store uses. Tables added by
 * MIGRATION 016 are not in the generated `Database` type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PushDb = { from: (table: string) => any };

export type SubscriptionKind = 'patient_device' | 'caregiver';

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** `patient_device`: a phone that shows reminders for `patientIds`.
   *  `caregiver`: a caregiver's own phone, for alerts. */
  kind: SubscriptionKind;
  /** The caregiver account that owns the link (whose patients these are). */
  caregiverId: string;
  patientIds: string[];
  /** UI language code, for the wording of pushed reminders. */
  language: string;
  /** IANA zone, so the server can tell what "09:00" means for this phone. */
  timezone: string;
}

export type NewSubscription = Omit<StoredSubscription, 'id'>;

const COLUMNS = 'id, endpoint, p256dh, auth, kind, caregiver_id, patient_ids, language, timezone';

interface Row {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  kind: SubscriptionKind;
  caregiver_id: string;
  patient_ids: string[] | null;
  language: string | null;
  timezone: string | null;
}

export function fromRow(r: Row): StoredSubscription {
  return {
    id: r.id,
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    auth: r.auth,
    kind: r.kind,
    caregiverId: r.caregiver_id,
    patientIds: r.patient_ids ?? [],
    language: r.language ?? 'en',
    timezone: r.timezone ?? 'Asia/Kolkata',
  };
}

/** Insert or replace by endpoint: re-subscribing the same browser updates its row. */
export async function upsertSubscription(db: PushDb, sub: NewSubscription): Promise<{ error: string | null }> {
  const { error } = await db.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      kind: sub.kind,
      caregiver_id: sub.caregiverId,
      patient_ids: sub.patientIds,
      language: sub.language,
      timezone: sub.timezone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  return { error: error ? String(error.message ?? error) : null };
}

export async function deleteSubscriptionByEndpoint(db: PushDb, endpoint: string): Promise<void> {
  await db.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

export async function deleteSubscriptionById(db: PushDb, id: string): Promise<void> {
  await db.from('push_subscriptions').delete().eq('id', id);
}

export async function listCaregiverSubscriptions(db: PushDb, caregiverId: string): Promise<StoredSubscription[]> {
  const { data, error } = await db
    .from('push_subscriptions')
    .select(COLUMNS)
    .eq('caregiver_id', caregiverId)
    .eq('kind', 'caregiver');
  if (error || !data) return [];
  return (data as Row[]).map(fromRow);
}

export async function listPatientDeviceSubscriptions(db: PushDb): Promise<StoredSubscription[]> {
  const { data, error } = await db.from('push_subscriptions').select(COLUMNS).eq('kind', 'patient_device');
  if (error || !data) return [];
  return (data as Row[]).map(fromRow);
}

export async function getSubscriptionByEndpoint(db: PushDb, endpoint: string): Promise<StoredSubscription | null> {
  const { data, error } = await db.from('push_subscriptions').select(COLUMNS).eq('endpoint', endpoint).maybeSingle();
  if (error || !data) return null;
  return fromRow(data as Row);
}
