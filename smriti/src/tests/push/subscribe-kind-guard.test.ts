import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { authenticateRequest } = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/supabase/server-auth', () => ({ authenticateRequest }));

const upserts: Array<Record<string, unknown>> = [];
let existing: Record<string, unknown> | null = null;
const serviceDb = {
  from: () => ({
    upsert: async (row: Record<string, unknown>) => (upserts.push(row), { error: null }),
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
  }),
};
vi.mock('@/lib/supabase/client', () => ({ createServiceRoleClient: () => serviceDb }));

import { POST } from '@/app/api/push/subscribe/route';

const VAPID = ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const body = { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'P', auth: 'A' } }, kind: 'caregiver', language: 'en' };
const post = () =>
  POST(new Request('http://localhost/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const row = (kind: string) => ({ id: 's', endpoint: body.subscription.endpoint, p256dh: 'P', auth: 'A', kind, caregiver_id: 'cg1', patient_ids: [], language: 'en', timezone: 'Asia/Kolkata' });

beforeEach(() => {
  VAPID.forEach((k) => (process.env[k] = 'mailto:a@b.c'));
  upserts.length = 0;
  existing = null;
  authenticateRequest.mockResolvedValue({
    userId: 'u',
    supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'cg1' } }) }) }) }) },
  });
});
afterEach(() => VAPID.forEach((k) => delete process.env[k]));

describe('/api/push/subscribe kind guard', () => {
  it('registers a caregiver phone', async () => {
    expect((await post()).status).toBe(200);
    expect(upserts[0]).toMatchObject({ kind: 'caregiver', caregiver_id: 'cg1', patient_ids: [] });
  });
  it('re-subscribing the same kind is fine', async () => {
    existing = row('caregiver');
    expect((await post()).status).toBe(200);
  });
  it('refuses to turn a patient-reminder browser into an alerts browser (409, nothing written)', async () => {
    existing = row('patient_device');
    const res = await post();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'endpoint_in_use', existingKind: 'patient_device' });
    expect(upserts).toHaveLength(0);
  });
});
