import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { authenticateRequest } = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/supabase/server-auth', () => ({ authenticateRequest }));

const upserts: Array<Record<string, unknown>> = [];
const deletes: string[] = [];
let patientRows: Array<{ id: string; caregiver_id: string }> = [];
let existing: Record<string, unknown> | null = null;

const serviceDb = {
  from: (table: string) => {
    if (table === 'push_subscriptions') {
      return {
        upsert: async (row: Record<string, unknown>) => {
          upserts.push(row);
          return { error: null };
        },
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
        delete: () => ({
          eq: async (_c: string, endpoint: string) => {
            deletes.push(endpoint);
            return { error: null };
          },
        }),
      };
    }
    if (table === 'patients') {
      return { select: () => ({ in: async (_c: string, ids: string[]) => ({ data: patientRows.filter((p) => ids.includes(p.id)), error: null }) }) };
    }
    throw new Error(`unexpected table ${table}`);
  },
};
vi.mock('@/lib/supabase/client', () => ({ createServiceRoleClient: () => serviceDb }));

import { POST, DELETE } from '@/app/api/push/subscribe/route';
import { signDeviceTrust } from '@/lib/auth/deviceTrustServer';

const VAPID = ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BP256', auth: 'AUTH' } };

const req = (body: unknown, headers: Record<string, string> = {}, method = 'POST') =>
  new Request('http://localhost/api/push/subscribe', { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

function callerSupabase(caregiverId: string | null, ownedPatients: string[]) {
  return {
    from: (table: string) => {
      if (table === 'caregivers') return { select: () => ({ eq: () => ({ single: async () => ({ data: caregiverId ? { id: caregiverId } : null }) }) }) };
      if (table === 'patients')
        return { select: () => ({ in: () => ({ eq: async () => ({ data: ownedPatients.map((id) => ({ id })), error: null }) }) }) };
      throw new Error(table);
    },
  };
}

beforeEach(() => {
  process.env.DEVICE_TRUST_SECRET = 'test-only-secret';
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.VAPID_SUBJECT = 'mailto:a@b.c';
  upserts.length = 0;
  deletes.length = 0;
  patientRows = [];
  existing = null;
  authenticateRequest.mockReset();
  authenticateRequest.mockResolvedValue(null);
});
afterEach(() => {
  for (const k of VAPID) delete process.env[k];
});

describe('POST /api/push/subscribe', () => {
  it('answers 503 and stores nothing when Web Push is not configured', async () => {
    for (const k of VAPID) delete process.env[k];
    const res = await POST(req({ subscription: sub, kind: 'caregiver' }));
    expect(res.status).toBe(503);
    expect(upserts).toHaveLength(0);
  });

  it('rejects an anonymous caller with no device-trust token', async () => {
    const res = await POST(req({ subscription: sub, kind: 'patient_device' }));
    expect(res.status).toBe(401);
  });

  it('rejects a forged device-trust token', async () => {
    const token = { ...signDeviceTrust('p1', 'auth-1'), patientId: 'p2' };
    const res = await POST(req({ subscription: sub, kind: 'patient_device', deviceTrustTokens: [token] }));
    expect(res.status).toBe(401);
    expect(upserts).toHaveLength(0);
  });

  it('stores a kiosk phone against the patients its valid tokens cover, not ids from the body', async () => {
    patientRows = [{ id: 'p1', caregiver_id: 'c1' }, { id: 'p2', caregiver_id: 'c1' }];
    const res = await POST(
      req({
        subscription: sub,
        kind: 'patient_device',
        patientIds: ['p1', 'p2', 'someone-else'],
        deviceTrustTokens: [signDeviceTrust('p1', 'auth-1'), signDeviceTrust('p2', 'auth-1')],
        language: 'hi',
        timezone: 'Asia/Kolkata',
      }),
    );
    expect(res.status).toBe(200);
    expect(upserts[0]).toMatchObject({
      endpoint: sub.endpoint,
      p256dh: 'BP256',
      auth: 'AUTH',
      kind: 'patient_device',
      caregiver_id: 'c1',
      patient_ids: ['p1', 'p2'],
      language: 'hi',
      timezone: 'Asia/Kolkata',
    });
  });

  it('lets a signed-in caregiver register their own phone for alerts', async () => {
    authenticateRequest.mockResolvedValue({ userId: 'u1', supabase: callerSupabase('c1', []) });
    const res = await POST(req({ subscription: sub, kind: 'caregiver' }, { authorization: 'Bearer x' }));
    expect(res.status).toBe(200);
    expect(upserts[0]).toMatchObject({ kind: 'caregiver', caregiver_id: 'c1', patient_ids: [] });
  });

  it('refuses a caregiver registering a phone for a patient that is not theirs', async () => {
    authenticateRequest.mockResolvedValue({ userId: 'u1', supabase: callerSupabase('c1', ['p1']) });
    const res = await POST(req({ subscription: sub, kind: 'patient_device', patientIds: ['p1', 'p9'] }, { authorization: 'Bearer x' }));
    expect(res.status).toBe(403);
    expect(upserts).toHaveLength(0);
  });

  it('validates the subscription shape and falls back on unknown language or time zone', async () => {
    authenticateRequest.mockResolvedValue({ userId: 'u1', supabase: callerSupabase('c1', []) });
    const auth = { authorization: 'Bearer x' };
    expect((await POST(req({ subscription: { endpoint: 'http://insecure.example/x', keys: sub.keys }, kind: 'caregiver' }, auth))).status).toBe(400);
    expect((await POST(req({ subscription: { endpoint: sub.endpoint }, kind: 'caregiver' }, auth))).status).toBe(400);
    expect((await POST(req({ subscription: sub, kind: 'nonsense' }, auth))).status).toBe(400);
    await POST(req({ subscription: sub, kind: 'caregiver', language: 'klingon', timezone: 'Mars/Base' }, auth));
    expect(upserts[0]).toMatchObject({ language: 'en', timezone: 'Asia/Kolkata' });
  });
});

describe('DELETE /api/push/subscribe', () => {
  it('lets a phone whose token covers the patient remove its subscription', async () => {
    existing = { id: 's1', endpoint: sub.endpoint, p256dh: 'p', auth: 'a', kind: 'patient_device', caregiver_id: 'c1', patient_ids: ['p1'], language: 'en', timezone: 'Asia/Kolkata' };
    const res = await DELETE(req({ endpoint: sub.endpoint, deviceTrustTokens: [signDeviceTrust('p1', 'auth-1')] }, {}, 'DELETE'));
    expect(res.status).toBe(200);
    expect(deletes).toEqual([sub.endpoint]);
  });

  it('refuses an unauthenticated removal', async () => {
    existing = { id: 's1', endpoint: sub.endpoint, p256dh: 'p', auth: 'a', kind: 'patient_device', caregiver_id: 'c1', patient_ids: ['p1'], language: 'en', timezone: 'Asia/Kolkata' };
    const res = await DELETE(req({ endpoint: sub.endpoint }, {}, 'DELETE'));
    expect(res.status).toBe(401);
    expect(deletes).toHaveLength(0);
  });
});
