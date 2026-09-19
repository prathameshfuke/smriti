import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock('web-push', () => ({ default: { sendNotification, setVapidDetails } }));

import { isPushConfigured, sendPushToCaregiver, sendPushToSubscription } from '@/lib/push/send';
import type { StoredSubscription } from '@/lib/push/subscriptionStore';

const ENV_KEYS = ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const saved: Record<string, string | undefined> = {};

function sub(over: Partial<StoredSubscription> = {}): StoredSubscription {
  return {
    id: 's1',
    endpoint: 'https://push.example/abc',
    p256dh: 'p',
    auth: 'a',
    kind: 'caregiver',
    caregiverId: 'c1',
    patientIds: [],
    language: 'en',
    timezone: 'Asia/Kolkata',
    ...over,
  };
}

/** Minimal fake of the supabase calls the store makes. */
function fakeDb(rows: StoredSubscription[]) {
  const deleted: string[] = [];
  const toRow = (r: StoredSubscription) => ({
    id: r.id,
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    auth: r.auth,
    kind: r.kind,
    caregiver_id: r.caregiverId,
    patient_ids: r.patientIds,
    language: r.language,
    timezone: r.timezone,
  });
  const db = {
    deleted,
    from: (table: string) => {
      expect(table).toBe('push_subscriptions');
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return builder;
        },
        delete: () => ({
          eq: async (_col: string, id: string) => {
            deleted.push(id);
            return { error: null };
          },
        }),
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data: rows
              .filter((r) => (filters.caregiver_id === undefined || r.caregiverId === filters.caregiver_id) && (filters.kind === undefined || r.kind === filters.kind))
              .map(toRow),
            error: null,
          }),
      };
      return builder;
    },
  };
  return db;
}

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  sendNotification.mockReset();
  setVapidDetails.mockReset();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function configure() {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.VAPID_SUBJECT = 'mailto:ops@example.org';
}

describe('Web Push is inert when not configured', () => {
  it('reports not configured and sends nothing, without throwing', async () => {
    expect(isPushConfigured()).toBe(false);
    const db = fakeDb([sub()]);
    const result = await sendPushToCaregiver(db as never, 'c1', { title: 'T', body: 'B' });
    expect(result).toEqual({ attempted: 0, sent: 0, removed: 0, failed: 0, skipped: 'not_configured' });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('needs all three variables', () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    expect(isPushConfigured()).toBe(false);
    process.env.VAPID_SUBJECT = 'mailto:ops@example.org';
    expect(isPushConfigured()).toBe(true);
  });
});

describe('sendPushToCaregiver', () => {
  it('sends the payload as JSON to each of the caregiver\'s subscriptions', async () => {
    configure();
    sendNotification.mockResolvedValue({ statusCode: 201 });
    const db = fakeDb([sub(), sub({ id: 's2', endpoint: 'https://push.example/def' }), sub({ id: 's3', caregiverId: 'other' }), sub({ id: 's4', kind: 'patient_device' })]);
    const result = await sendPushToCaregiver(db as never, 'c1', { title: 'Alert', body: 'Please check on Hari', url: '/caregiver/alerts' });
    expect(result).toMatchObject({ attempted: 2, sent: 2, removed: 0, failed: 0 });
    expect(setVapidDetails).toHaveBeenCalledWith('mailto:ops@example.org', 'pub', 'priv');
    const [target, body] = sendNotification.mock.calls[0];
    expect(target).toEqual({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } });
    expect(JSON.parse(body)).toEqual({ title: 'Alert', body: 'Please check on Hari', url: '/caregiver/alerts' });
  });

  it('removes a subscription the push service says is gone (404/410) and counts other errors as failed', async () => {
    configure();
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    const db = fakeDb([sub(), sub({ id: 's2', endpoint: 'https://push.example/def' })]);
    const result = await sendPushToCaregiver(db as never, 'c1', { title: 'T', body: 'B' });
    expect(result).toMatchObject({ attempted: 2, sent: 0, removed: 1, failed: 1 });
    expect(db.deleted).toEqual(['s1']);
  });

  it('never rejects: a failing lookup is reported, not thrown', async () => {
    configure();
    const db = { from: () => { throw new Error('db down'); } };
    await expect(sendPushToCaregiver(db as never, 'c1', { title: 'T', body: 'B' })).resolves.toMatchObject({ sent: 0, failed: 0 });
  });
});

describe('sendPushToSubscription', () => {
  it('returns "gone" for an expired endpoint and "ok" otherwise', async () => {
    configure();
    sendNotification.mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 404 }));
    expect(await sendPushToSubscription(sub(), { title: 'T', body: 'B' })).toBe('ok');
    expect(await sendPushToSubscription(sub(), { title: 'T', body: 'B' })).toBe('gone');
  });
});
