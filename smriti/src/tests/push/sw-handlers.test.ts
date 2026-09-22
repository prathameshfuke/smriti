import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/lib/db/schema';
import { NOTIFY_DB, writeNotifyPrefs, claimNotification } from '@/lib/push/notifyStore';
import {
  notifyDueFromLocalDb,
  showPushNotification,
  safeClickUrl,
  handleNotificationClick,
  REMINDER_TAG_PREFIX,
} from '../../sw/handlers';

const at = (h: number, m: number) => new Date(2026, 8, 19, h, m);

function fakeRegistration() {
  const shown: Array<{ title: string; options: NotificationOptions }> = [];
  return {
    shown,
    showNotification: vi.fn(async (title: string, options: NotificationOptions) => {
      shown.push({ title, options });
    }),
  };
}

async function reset() {
  await db.reminderSchedules.clear();
  await db.reminderAcks.clear();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase(NOTIFY_DB);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}

const sched = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  patientId: 'p1',
  reminderType: 'medication' as const,
  label: 'Metformin 500mg',
  timeOfDay: '09:00',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  isActive: true,
  updatedAt: new Date().toISOString(),
  ...over,
});

describe('service worker: offline due-reminder check (reads IndexedDB, no network)', () => {
  beforeEach(reset);

  it('shows a notification for a due reminder read from the app database', async () => {
    await db.reminderSchedules.put(sched());
    const reg = fakeRegistration();
    const n = await notifyDueFromLocalDb(reg, at(9, 0));
    expect(n).toBe(1);
    expect(reg.shown[0].options.tag).toBe(`${REMINDER_TAG_PREFIX}r1:2026-09-19`);
    expect(reg.shown[0].options.body).toBe('Time for your medicine');
  });

  it('never puts the encrypted label (a medicine name) on the lock screen', async () => {
    await db.reminderSchedules.put(sched());
    const reg = fakeRegistration();
    await notifyDueFromLocalDb(reg, at(9, 0));
    expect(JSON.stringify(reg.shown)).not.toContain('Metformin');
  });

  it('uses the language strings the page stored', async () => {
    await db.reminderSchedules.put(sched());
    await writeNotifyPrefs({ language: 'hi', title: 'स्मृति', strings: { medication: 'दवाई लेने का समय' } });
    const reg = fakeRegistration();
    await notifyDueFromLocalDb(reg, at(9, 0));
    expect(reg.shown[0].title).toBe('स्मृति');
    expect(reg.shown[0].options.body).toBe('दवाई लेने का समय');
  });

  it('notifies an occurrence only once however many times the check runs', async () => {
    await db.reminderSchedules.put(sched());
    const reg = fakeRegistration();
    expect(await notifyDueFromLocalDb(reg, at(9, 0))).toBe(1);
    expect(await notifyDueFromLocalDb(reg, at(9, 1))).toBe(0);
    expect(reg.shown).toHaveLength(1);
  });

  it('skips an occurrence the open app already claimed', async () => {
    await db.reminderSchedules.put(sched());
    await claimNotification('r1:2026-09-19');
    const reg = fakeRegistration();
    expect(await notifyDueFromLocalDb(reg, at(9, 0))).toBe(0);
  });

  it('skips an acknowledged reminder and one that is not due', async () => {
    await db.reminderSchedules.put(sched());
    await db.reminderSchedules.put(sched({ id: 'r2', timeOfDay: '15:00' }));
    await db.reminderAcks.add({
      id: 'k1',
      reminderId: 'r1',
      patientId: 'p1',
      scheduledAt: '2026-09-19T09:00:00.000Z',
      acknowledgedAt: at(9, 0).toISOString(),
      ackMethod: 'touch',
      synced: false,
    });
    const reg = fakeRegistration();
    expect(await notifyDueFromLocalDb(reg, at(9, 1))).toBe(0);
  });

  it('puts a Done and a Later action, plus the ack fields, on every reminder notification', async () => {
    await db.reminderSchedules.put(sched());
    const reg = fakeRegistration();
    await notifyDueFromLocalDb(reg, at(9, 0));
    const opts = reg.shown[0].options as NotificationOptions & {
      actions?: Array<{ action: string; title: string }>;
      data: { reminderId: string; patientId: string; scheduledAt: string; occurrenceKey: string };
    };
    expect(opts.actions).toEqual([
      { action: 'ack', title: 'Done' },
      { action: 'snooze', title: 'Later' },
    ]);
    expect(opts.data).toMatchObject({ reminderId: 'r1', patientId: 'p1', scheduledAt: '2026-09-19T09:00:00.000Z' });
  });

  it('describes a due appointment prompt with its time, still without the facility name', async () => {
    await db.reminderSchedules.put(
      sched({
        id: 'a1',
        reminderType: 'appointment',
        label: 'Clinic',
        facilityName: 'Tezpur CHC',
        timeOfDay: '10:30',
        daysOfWeek: [],
        appointmentDate: '2026-09-20',
        remindDayBeforeTime: '18:00',
      }),
    );
    const reg = fakeRegistration();
    await notifyDueFromLocalDb(reg, at(18, 30));
    expect(reg.shown[0].options.body).toBe('You have an appointment tomorrow at 10:30 am');
    expect(reg.shown[0].options.tag).toBe(`${REMINDER_TAG_PREFIX}a1:2026-09-19`);
  });

  it('does nothing, without throwing, when the app database has never been created', async () => {
    await db.delete();
    const reg = fakeRegistration();
    await expect(notifyDueFromLocalDb(reg, at(9, 0))).resolves.toBe(0);
    await db.open();
  });
});

describe('service worker: push events', () => {
  it('shows what the server sent', async () => {
    const reg = fakeRegistration();
    await showPushNotification(reg, { title: 'SMRITI', body: 'Time to drink water', tag: 'smriti-reminder:x:2026-09-19', url: '/app' });
    expect(reg.shown[0].title).toBe('SMRITI');
    expect(reg.shown[0].options).toMatchObject({ body: 'Time to drink water', tag: 'smriti-reminder:x:2026-09-19', data: { url: '/app' } });
  });

  it('still shows something for an empty or malformed payload (browsers require a visible notification)', async () => {
    const reg = fakeRegistration();
    await showPushNotification(reg, null);
    expect(reg.shown).toHaveLength(1);
    expect(reg.shown[0].title).toBe('SMRITI');
  });
});

describe('service worker: notification click', () => {
  it('only ever opens same-origin paths', () => {
    expect(safeClickUrl('/reminders')).toBe('/reminders');
    expect(safeClickUrl('https://evil.example/x')).toBe('/app');
    expect(safeClickUrl('//evil.example')).toBe('/app');
    expect(safeClickUrl(undefined)).toBe('/app');
  });

  it('focuses an open window instead of opening a second one', async () => {
    const focus = vi.fn(async () => undefined);
    const clients = { matchAll: vi.fn(async () => [{ url: 'http://localhost/app', focus }]), openWindow: vi.fn() };
    const notification = { close: vi.fn(), data: { url: '/app' } };
    await handleNotificationClick(notification, clients as never, 'http://localhost');
    expect(notification.close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(clients.openWindow).not.toHaveBeenCalled();
  });

  it('opens the app when none is open', async () => {
    const clients = { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) };
    await handleNotificationClick({ close: vi.fn(), data: { url: '/reminders' } }, clients as never, 'http://localhost');
    expect(clients.openWindow).toHaveBeenCalledWith('http://localhost/reminders');
  });

  it('"ack" action writes the reminder done, straight to IndexedDB, without opening any window', async () => {
    await reset();
    const clients = { matchAll: vi.fn(async () => []), openWindow: vi.fn() };
    const data = { url: '/app', reminderId: 'r1', patientId: 'p1', scheduledAt: '2026-09-19T09:00:00.000Z', occurrenceKey: 'r1:2026-09-19' };
    const notification = { close: vi.fn(), data };
    await handleNotificationClick(notification, clients as never, 'http://localhost', 'ack');
    expect(notification.close).toHaveBeenCalled();
    expect(clients.matchAll).not.toHaveBeenCalled();
    expect(clients.openWindow).not.toHaveBeenCalled();
    const acks = await db.reminderAcks.where('reminderId').equals('r1').toArray();
    expect(acks).toHaveLength(1);
    expect(acks[0]).toMatchObject({ patientId: 'p1', scheduledAt: '2026-09-19T09:00:00.000Z', ackMethod: 'touch', synced: false });
    expect(acks[0].acknowledgedAt).not.toBeNull();
  });

  it('"snooze" action un-claims the occurrence so it counts as due again, without opening any window', async () => {
    await reset();
    await claimNotification('r1:2026-09-19');
    const clients = { matchAll: vi.fn(async () => []), openWindow: vi.fn() };
    const notification = { close: vi.fn(), data: { url: '/app', occurrenceKey: 'r1:2026-09-19' } };
    await handleNotificationClick(notification, clients as never, 'http://localhost', 'snooze');
    expect(notification.close).toHaveBeenCalled();
    expect(clients.openWindow).not.toHaveBeenCalled();
    // Un-claimed: the same occurrence can be claimed (and so notified) again.
    expect(await claimNotification('r1:2026-09-19')).toBe(true);
  });
});
