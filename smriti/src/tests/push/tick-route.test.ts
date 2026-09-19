import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { runReminderTick } = vi.hoisted(() => ({
  runReminderTick: vi.fn(async () => ({ subscriptions: 1, due: 1, sent: 1, failed: 0, removed: 0 })),
}));
vi.mock('@/lib/push/tick', () => ({ runReminderTick }));
vi.mock('@/lib/supabase/client', () => ({ createServiceRoleClient: () => ({}) }));

import { GET, POST } from '@/app/api/push/tick/route';

const KEYS = ['CRON_SECRET', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const req = (headers: Record<string, string> = {}, method = 'GET') => new Request('http://localhost/api/push/tick', { method, headers });

beforeEach(() => {
  process.env.CRON_SECRET = 's3cret-value';
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.VAPID_SUBJECT = 'mailto:a@b.c';
  runReminderTick.mockClear();
});
afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe('/api/push/tick', () => {
  it('is closed (503) when CRON_SECRET is not configured, never open by default', async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req({ authorization: 'Bearer anything' }))).status).toBe(503);
    expect(runReminderTick).not.toHaveBeenCalled();
  });

  it('rejects a missing or wrong secret', async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req({ authorization: 'Bearer nope' }))).status).toBe(401);
    expect((await GET(req({ 'x-cron-secret': 'nope' }))).status).toBe(401);
    expect(runReminderTick).not.toHaveBeenCalled();
  });

  it('runs the tick for the Vercel-style bearer secret and for x-cron-secret, on GET and POST', async () => {
    expect((await GET(req({ authorization: 'Bearer s3cret-value' }))).status).toBe(200);
    expect((await POST(req({ 'x-cron-secret': 's3cret-value' }, 'POST'))).status).toBe(200);
    expect(runReminderTick).toHaveBeenCalledTimes(2);
  });

  it('reports not configured (503) when VAPID keys are missing, even with the right secret', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const res = await GET(req({ authorization: 'Bearer s3cret-value' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'push_not_configured' });
  });
});
