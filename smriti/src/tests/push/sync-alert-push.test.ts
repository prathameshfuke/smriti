import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemorySupabase, type Tables } from '../helpers/memorySupabase';

const { sendPushToCaregiver } = vi.hoisted(() => ({ sendPushToCaregiver: vi.fn() }));
vi.mock('@/lib/push/send', async (orig) => ({ ...(await orig<typeof import('@/lib/push/send')>()), sendPushToCaregiver }));

let db = createMemorySupabase({});
let userCounter = 0;
vi.mock('@/lib/supabase/client', () => ({ createServiceRoleClient: () => db }));
vi.mock('@/lib/supabase/server-auth', () => ({
  authenticateRequest: async () => ({ userId: `user-${userCounter}`, supabase: db }),
}));

import { POST } from '@/app/api/sync/route';

const ENV = ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const day = (offsetDays: number) => iso(offsetDays).slice(0, 10);
const UUID = '11111111-1111-4111-8111-111111111111';

function base(): Tables {
  return {
    caregivers: [{ id: 'cg1', auth_id: 'auth-1', preferred_language: 'hi' }],
    patients: [{ id: 'p1', caregiver_id: 'cg1', display_name: 'Ama Devi', created_at: iso(-30), updated_at: iso(-1) }],
    alerts: [],
    daily_summaries: [],
    reminder_schedules: [],
    reminder_acks: [],
  };
}

async function sync(patient: Record<string, unknown> = {}) {
  userCounter += 1; // the route rate-limits per user
  for (const c of db.tables.caregivers) c.auth_id = `user-${userCounter}`;
  const res = await POST(
    new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: 'd1', lastSyncTimestamp: null, patients: [{ patientId: 'p1', ...patient }] }),
    }),
  );
  return { res, body: await res.json() };
}

/** 7 steady days then a collapse today, so the cognitive-drop detector fires. */
function seedDrop(tables: Tables) {
  for (let i = 0; i < 8; i += 1) {
    tables.daily_summaries.push({ patient_id: 'p1', game_type: 'object_hunt', summary_date: day(-i), accuracy_pct: i === 0 ? 5 : 80 });
  }
}
const todaySummary = { id: UUID, patientId: 'p1', summaryDate: day(0), gameType: 'object_hunt', totalRounds: 10, correctRounds: 1 };

beforeEach(() => {
  sendPushToCaregiver.mockReset().mockResolvedValue({ attempted: 1, sent: 1, removed: 0, failed: 0 });
  ENV.forEach((k) => (process.env[k] = k === 'VAPID_SUBJECT' ? 'mailto:a@b.c' : 'x'));
  db = createMemorySupabase(base());
});
afterEach(() => ENV.forEach((k) => delete process.env[k]));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('sync route: new alert -> caregiver push', () => {
  it('missed_sessions: inserts the alert then pushes exactly once, localised, deep-linked', async () => {
    const { res } = await sync();
    await flush();
    expect(res.status).toBe(200);
    expect(db.tables.alerts).toHaveLength(1);
    expect(sendPushToCaregiver).toHaveBeenCalledTimes(1);
    const [, caregiverId, payload] = sendPushToCaregiver.mock.calls[0];
    expect(caregiverId).toBe('cg1');
    expect(payload.url).toBe('/caregiver/patients/p1');
    expect(payload.title).toContain('Ama Devi');
    expect(payload.title).toContain('ध्यान दें'); // hi, yellow
    expect(payload.body).toMatch(/SMRITI/);
    expect(payload.tag).toBe('alert-missed_sessions-p1');
  });

  it('cognitive_drop: red alert pushes once', async () => {
    seedDrop(db.tables);
    await sync({ dailySummaries: [todaySummary] });
    await flush();
    const dropAlerts = db.tables.alerts.filter((a) => a.alert_type === 'cognitive_drop');
    expect(dropAlerts).toHaveLength(1);
    const calls = sendPushToCaregiver.mock.calls.filter(([, , p]) => p.tag === 'alert-cognitive_drop-p1');
    expect(calls).toHaveLength(1);
    expect(calls[0][2].title).toContain('जरूरी'); // hi, red
  });

  it('dedupe-skipped path and re-syncs do not notify again', async () => {
    seedDrop(db.tables);
    await sync({ dailySummaries: [todaySummary] });
    await flush();
    const first = sendPushToCaregiver.mock.calls.length;
    expect(first).toBe(1);
    await sync({ dailySummaries: [todaySummary] });
    await sync({ dailySummaries: [todaySummary] });
    await flush();
    expect(db.tables.alerts).toHaveLength(1);
    expect(sendPushToCaregiver).toHaveBeenCalledTimes(first);
  });

  it('resolving an alert (a game was played) sends nothing', async () => {
    db.tables.alerts.push({ id: 'old', patient_id: 'p1', alert_type: 'missed_sessions', is_resolved: false, created_at: iso(-1) });
    db.tables.daily_summaries.push({ patient_id: 'p1', game_type: 'object_hunt', summary_date: day(0), accuracy_pct: 70 });
    await sync();
    await flush();
    expect(db.tables.alerts[0].is_resolved).toBe(true);
    expect(sendPushToCaregiver).not.toHaveBeenCalled();
  });

  it('a failed insert sends nothing', async () => {
    db = createMemorySupabase(base(), { failInsertOn: ['alerts'] });
    const { res } = await sync();
    await flush();
    expect(res.status).toBe(200);
    expect(sendPushToCaregiver).not.toHaveBeenCalled();
  });

  it('sync still succeeds and keeps the alert when the sender throws or rejects', async () => {
    sendPushToCaregiver.mockImplementation(() => {
      throw new Error('sync throw');
    });
    let out = await sync();
    await flush();
    expect(out.res.status).toBe(200);
    expect(db.tables.alerts).toHaveLength(1);

    db = createMemorySupabase(base());
    sendPushToCaregiver.mockRejectedValue(new Error('async boom'));
    out = await sync();
    await flush();
    expect(out.res.status).toBe(200);
    expect(db.tables.alerts).toHaveLength(1);
    expect(out.body.updates.alerts).toHaveLength(1);
  });

  it('does not wait for a slow push before responding', async () => {
    sendPushToCaregiver.mockImplementation(() => new Promise(() => undefined)); // never resolves
    const { res } = await sync();
    expect(res.status).toBe(200);
  });

  it('push unconfigured: sync succeeds, sender is never reached', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const { res } = await sync();
    await flush();
    expect(res.status).toBe(200);
    expect(db.tables.alerts).toHaveLength(1);
    expect(sendPushToCaregiver).not.toHaveBeenCalled();
  });
});
