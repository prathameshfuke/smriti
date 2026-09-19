import { describe, it, expect, vi } from 'vitest';
import { runReminderTick } from '@/lib/push/tick';
import type { PushDb } from '@/lib/push/subscriptionStore';

interface World {
  subs: Array<Record<string, unknown>>;
  schedules: Array<Record<string, unknown>>;
  acks: Array<Record<string, unknown>>;
  deliveries: Set<string>;
  deletedSubs: string[];
  removedDeliveries: string[];
}

function world(over: Partial<World> = {}): World {
  return { subs: [], schedules: [], acks: [], deliveries: new Set(), deletedSubs: [], removedDeliveries: [], ...over };
}

function fakeDb(w: World): PushDb {
  return {
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      const data = () =>
        table === 'push_subscriptions' ? w.subs : table === 'reminder_schedules' ? w.schedules : table === 'reminder_acks' ? w.acks : [];
      for (const m of ['select', 'eq', 'in', 'gte', 'lt']) b[m] = () => b;
      b.then = (resolve: (v: unknown) => void) => resolve({ data: data(), error: null });
      b.insert = async (row: { subscription_id: string; occurrence_key: string }) => {
        const k = `${row.subscription_id}|${row.occurrence_key}`;
        if (w.deliveries.has(k)) return { error: { code: '23505' } };
        w.deliveries.add(k);
        return { error: null };
      };
      b.delete = () => {
        const d: Record<string, unknown> = {};
        d.eq = (col: string, val: string) => {
          if (table === 'push_subscriptions') w.deletedSubs.push(val);
          if (table === 'push_deliveries') w.removedDeliveries.push(`${col}:${val}`);
          return d;
        };
        d.lt = async () => ({ error: null });
        d.then = (r: (v: unknown) => void) => r({ error: null });
        return d;
      };
      return b;
    },
  };
}

const sub = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  endpoint: 'https://push.example/1',
  p256dh: 'p',
  auth: 'a',
  kind: 'patient_device',
  caregiver_id: 'c1',
  patient_ids: ['p1'],
  language: 'en',
  timezone: 'Asia/Kolkata',
  ...over,
});
const schedule = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  patient_id: 'p1',
  reminder_type: 'medication',
  label: 'Metformin',
  time_of_day: '09:00:00',
  days_of_week: [0, 1, 2, 3, 4, 5, 6],
  is_active: true,
  appointment_date: null,
  remind_day_before_time: null,
  remind_day_of_time: null,
  ...over,
});

// 09:03 in India on Saturday 2026-09-19
const NOW = new Date('2026-09-19T03:33:00Z');

describe('runReminderTick (server: sends due reminders to subscribed phones)', () => {
  it('sends a due reminder in the phone\'s own time zone and language, without the medicine name', async () => {
    const w = world({ subs: [sub({ language: 'hi' })], schedules: [schedule()] });
    const send = vi.fn(async () => 'ok' as const);
    const res = await runReminderTick(fakeDb(w), NOW, { send });
    expect(res).toMatchObject({ subscriptions: 1, due: 1, sent: 1 });
    const [, payload] = send.mock.calls[0] as unknown as [unknown, { title: string; body: string; tag: string; url: string }];
    expect(payload.body).toBe('दवाई लेने का समय');
    expect(payload.body).not.toContain('Metformin');
    expect(payload.tag).toBe('smriti-reminder:r1:2026-09-19');
    expect(payload.url).toBe('/app');
  });

  it('does not send the same occurrence twice across ticks', async () => {
    const w = world({ subs: [sub()], schedules: [schedule()] });
    const send = vi.fn(async () => 'ok' as const);
    await runReminderTick(fakeDb(w), NOW, { send });
    const second = await runReminderTick(fakeDb(w), new Date(NOW.getTime() + 60_000), { send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(second.sent).toBe(0);
  });

  it('catches a reminder up to the look-back late, but not before its time and not after the window', async () => {
    const send = vi.fn(async () => 'ok' as const);
    const early = world({ subs: [sub()], schedules: [schedule({ time_of_day: '09:10:00' })] });
    expect((await runReminderTick(fakeDb(early), NOW, { send })).due).toBe(0);
    const late = world({ subs: [sub()], schedules: [schedule({ time_of_day: '08:00:00' })] });
    expect((await runReminderTick(fakeDb(late), NOW, { send, lookbackMinutes: 6 })).due).toBe(0);
    const ok = world({ subs: [sub()], schedules: [schedule({ time_of_day: '08:58:00' })] });
    expect((await runReminderTick(fakeDb(ok), NOW, { send, lookbackMinutes: 6 })).due).toBe(1);
  });

  it('skips a reminder already acknowledged on the phone and synced', async () => {
    const w = world({
      subs: [sub()],
      schedules: [schedule()],
      acks: [{ reminder_id: 'r1', scheduled_at: '2026-09-19T09:00:00.000Z', acknowledged_at: '2026-09-19T03:32:00.000Z' }],
    });
    const send = vi.fn(async () => 'ok' as const);
    expect((await runReminderTick(fakeDb(w), NOW, { send })).sent).toBe(0);
  });

  it('only considers the patients this phone is linked to', async () => {
    const w = world({ subs: [sub({ patient_ids: ['p2'] })], schedules: [schedule()] });
    const send = vi.fn(async () => 'ok' as const);
    expect((await runReminderTick(fakeDb(w), NOW, { send })).due).toBe(0);
  });

  it('deletes a subscription the push service reports gone, and lets a failed send retry next tick', async () => {
    const gone = world({ subs: [sub()], schedules: [schedule()] });
    const r1 = await runReminderTick(fakeDb(gone), NOW, { send: async () => 'gone' });
    expect(gone.deletedSubs).toEqual(['s1']);
    expect(r1.removed).toBe(1);

    const failing = world({ subs: [sub()], schedules: [schedule()] });
    const r2 = await runReminderTick(fakeDb(failing), NOW, { send: async () => 'failed' });
    expect(r2).toMatchObject({ sent: 0, failed: 1 });
    expect(failing.removedDeliveries.length).toBeGreaterThan(0);
  });

  it('with no subscriptions it does nothing', async () => {
    const send = vi.fn();
    expect(await runReminderTick(fakeDb(world()), NOW, { send })).toMatchObject({ subscriptions: 0, sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});
