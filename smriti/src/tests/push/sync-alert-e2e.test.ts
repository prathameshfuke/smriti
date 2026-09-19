/**
 * Integration-style, no phone: the real sync route handler, the real
 * alertNotify + send + subscriptionStore, an in-memory Supabase, and only the
 * `web-push` transport stubbed. Proves insert -> a delivery request built for
 * the caregiver's stored subscription (and only theirs).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemorySupabase } from '../helpers/memorySupabase';

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock('web-push', () => ({ default: { sendNotification, setVapidDetails } }));

let db = createMemorySupabase({});
let n = 0; // the route rate-limits per user
vi.mock('@/lib/supabase/client', () => ({ createServiceRoleClient: () => db }));
vi.mock('@/lib/supabase/server-auth', () => ({ authenticateRequest: async () => ({ userId: `e2e-user-${n}`, supabase: db }) }));

import { POST } from '@/app/api/sync/route';

const ENV = ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const flush = () => new Promise((r) => setTimeout(r, 10));
const sub = (id: string, cg: string, kind: string, endpoint: string) => ({
  id, endpoint, p256dh: `p-${id}`, auth: `a-${id}`, kind, caregiver_id: cg, patient_ids: [], language: 'en', timezone: 'Asia/Kolkata',
});

beforeEach(() => {
  n += 1;
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
  ENV.forEach((k) => (process.env[k] = k === 'VAPID_SUBJECT' ? 'mailto:a@b.c' : 'x'));
  db = createMemorySupabase({
    caregivers: [{ id: 'cg1', auth_id: `e2e-user-${n}`, preferred_language: 'bn' }],
    patients: [{ id: 'p1', caregiver_id: 'cg1', display_name: 'Ama Devi', created_at: new Date(Date.now() - 30 * 864e5).toISOString(), updated_at: new Date().toISOString() }],
    alerts: [], daily_summaries: [], reminder_schedules: [], reminder_acks: [],
    push_subscriptions: [
      sub('s1', 'cg1', 'caregiver', 'https://push.example/caregiver-phone'),
      sub('s2', 'cg1', 'patient_device', 'https://push.example/patient-phone'),
      sub('s3', 'other', 'caregiver', 'https://push.example/someone-else'),
    ],
  });
});
afterEach(() => ENV.forEach((k) => delete process.env[k]));

describe('sync -> alert -> web-push delivery request', () => {
  it('builds one request, for the owning caregiver\'s own phone only, with a clinical-detail-free payload', async () => {
    const res = await POST(
      new Request('http://localhost/api/sync', {
        method: 'POST',
        headers: { authorization: 'Bearer t' },
        body: JSON.stringify({ deviceId: 'd', lastSyncTimestamp: null, patients: [{ patientId: 'p1' }] }),
      }),
    );
    await flush();
    expect(res.status).toBe(200);
    expect(db.tables.alerts).toHaveLength(1);

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [subscription, body] = sendNotification.mock.calls[0];
    expect(subscription).toEqual({ endpoint: 'https://push.example/caregiver-phone', keys: { p256dh: 'p-s1', auth: 'a-s1' } });
    const payload = JSON.parse(body);
    expect(payload).toMatchObject({ url: '/caregiver/patients/p1', tag: 'alert-missed_sessions-p1' });
    expect(payload.title).toContain('Ama Devi');
    expect(payload.title).toContain('মনোযোগ দরকার'); // bn
    expect(`${payload.title}${payload.body}`).not.toMatch(/\d|medic/i);
  });

  it('a gone (410) subscription is pruned and the sync still succeeds', async () => {
    sendNotification.mockRejectedValue({ statusCode: 410 });
    const res = await POST(
      new Request('http://localhost/api/sync', {
        method: 'POST',
        headers: { authorization: 'Bearer t' },
        body: JSON.stringify({ deviceId: 'd', lastSyncTimestamp: null, patients: [{ patientId: 'p1' }] }),
      }),
    );
    await flush();
    expect(res.status).toBe(200);
    expect(db.tables.push_subscriptions.map((s) => s.id)).not.toContain('s1');
  });
});
