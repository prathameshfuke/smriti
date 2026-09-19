import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemorySupabase } from '../helpers/memorySupabase';

const { sendPushToCaregiver } = vi.hoisted(() => ({ sendPushToCaregiver: vi.fn() }));
vi.mock('@/lib/push/send', async (orig) => ({ ...(await orig<typeof import('@/lib/push/send')>()), sendPushToCaregiver }));

let service = createMemorySupabase({});
vi.mock('@/lib/supabase/client', () => ({ createServiceRoleClient: () => service }));

import { buildAlertPayload, notifyNewAlert } from '@/lib/push/alertNotify';
import en from '@/lib/i18n/locales/en.json';
import hi from '@/lib/i18n/locales/hi.json';

const ENV = ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const alert = { alertId: 'a1', caregiverId: 'cg1', patientId: 'p1', type: 'missed_sessions' as const, severity: 'yellow' as const };

function seed(language: string | undefined) {
  service = createMemorySupabase({
    caregivers: [{ id: 'cg1', preferred_language: language }],
    patients: [{ id: 'p1', display_name: 'Ama Devi', caregiver_id: 'cg1' }],
  });
}

beforeEach(() => {
  sendPushToCaregiver.mockReset().mockResolvedValue({ attempted: 1, sent: 1, removed: 0, failed: 0 });
  ENV.forEach((k) => (process.env[k] = k === 'VAPID_SUBJECT' ? 'mailto:a@b.c' : 'x'));
  seed('en');
});
afterEach(() => ENV.forEach((k) => delete process.env[k]));

describe('buildAlertPayload', () => {
  it('names the patient and severity, deep-links to the patient page and tags per patient+type', () => {
    const p = buildAlertPayload(alert, 'Ama Devi', 'en');
    expect(p.title).toBe('Ama Devi: Needs attention');
    expect(p.body).toBe(en.alertPush.missed_sessions);
    expect(p.url).toBe('/caregiver/patients/p1');
    expect(p.tag).toBe('alert-missed_sessions-p1');
  });

  it('uses red wording for red alerts', () => {
    expect(buildAlertPayload({ ...alert, type: 'cognitive_drop', severity: 'red' }, 'Ama', 'en').title).toBe('Ama: Urgent');
  });

  it('localises to the caregiver language and falls back to English for unknown or unsupported ones', () => {
    expect(buildAlertPayload(alert, 'Ama', 'hi').body).toBe(hi.alertPush.missed_sessions);
    expect(buildAlertPayload(alert, 'Ama', 'hi').title).toBe(`Ama: ${hi.alertPush.severityYellow}`);
    for (const lang of ['brx', 'mni', 'xx', undefined, null]) {
      expect(buildAlertPayload(alert, 'Ama', lang as string).body).toBe(en.alertPush.missed_sessions);
    }
  });

  it('carries no clinical detail: no numbers, no medication words, in any language', () => {
    for (const lang of ['en', 'as', 'hi', 'bn', 'ne']) {
      for (const type of ['cognitive_drop', 'missed_sessions', 'low_adherence'] as const) {
        const p = buildAlertPayload({ ...alert, type }, 'Ama', lang);
        const text = `${p.title} ${p.body}`;
        expect(text).not.toMatch(/\d/);
        expect(text).not.toMatch(/medic|medicine|tablet|dose|pill|mg\b|donepezil|memantine/i);
      }
    }
  });
});

describe('notifyNewAlert', () => {
  it('sends once to the owning caregiver with the localised payload', async () => {
    seed('hi');
    await notifyNewAlert(alert);
    expect(sendPushToCaregiver).toHaveBeenCalledTimes(1);
    const [db, caregiverId, payload] = sendPushToCaregiver.mock.calls[0];
    expect(db).toBe(service);
    expect(caregiverId).toBe('cg1');
    expect(payload).toEqual(buildAlertPayload(alert, 'Ama Devi', 'hi'));
  });

  it('is a silent no-op when push is not configured (no queries, no send)', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    await notifyNewAlert(alert);
    expect(sendPushToCaregiver).not.toHaveBeenCalled();
  });

  it('never rejects when the sender throws or the lookups fail', async () => {
    sendPushToCaregiver.mockRejectedValue(new Error('boom'));
    await expect(notifyNewAlert(alert)).resolves.toBeUndefined();
    service = { from: () => { throw new Error('db down'); } } as never;
    await expect(notifyNewAlert(alert)).resolves.toBeUndefined();
  });

  it('does nothing when the patient row is gone', async () => {
    service = createMemorySupabase({ caregivers: [{ id: 'cg1', preferred_language: 'en' }], patients: [] });
    await notifyNewAlert(alert);
    expect(sendPushToCaregiver).not.toHaveBeenCalled();
  });
});
