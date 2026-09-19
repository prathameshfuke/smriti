import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { NOTIFY_DB, readNotifyPrefs } from '@/lib/push/notifyStore';
import {
  enableReminderNotifications,
  getNotifySupport,
  showReminderNotification,
  urlBase64ToUint8Array,
} from '@/lib/push/client';

type Perm = 'default' | 'granted' | 'denied';

function installNotification(permission: Perm, requestResult: Perm = 'granted') {
  const ctor = vi.fn();
  Object.assign(ctor, { permission, requestPermission: vi.fn(async () => {
    (ctor as unknown as { permission: Perm }).permission = requestResult;
    return requestResult;
  }) });
  vi.stubGlobal('Notification', ctor);
  return ctor as unknown as { requestPermission: ReturnType<typeof vi.fn> } & ReturnType<typeof vi.fn>;
}

function installServiceWorker(reg: Record<string, unknown> | null) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn(async () => reg ?? undefined), ready: reg ? Promise.resolve(reg) : new Promise(() => undefined) },
  });
}

async function resetNotifyDb() {
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase(NOTIFY_DB);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}

const savedKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

beforeEach(async () => {
  await resetNotifyDb();
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (savedKey === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = savedKey;
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
});

describe('showReminderNotification (page side of the dedupe)', () => {
  it('shows through the service worker registration, tagged, and only once per occurrence', async () => {
    installNotification('granted');
    const showNotification = vi.fn(async () => undefined);
    installServiceWorker({ showNotification });
    expect(await showReminderNotification('r1:2026-09-19', 'SMRITI', 'Drink water')).toBe('shown');
    expect(showNotification).toHaveBeenCalledWith('SMRITI', expect.objectContaining({ body: 'Drink water', tag: 'smriti-reminder:r1:2026-09-19' }));
    expect(await showReminderNotification('r1:2026-09-19', 'SMRITI', 'Drink water')).toBe('duplicate');
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it('falls back to a plain Notification when there is no service worker', async () => {
    const N = installNotification('granted');
    installServiceWorker(null);
    expect(await showReminderNotification('r2:2026-09-19', 'SMRITI', 'Walk')).toBe('shown');
    expect(N).toHaveBeenCalledWith('SMRITI', expect.objectContaining({ body: 'Walk', tag: 'smriti-reminder:r2:2026-09-19' }));
  });

  it('does nothing without permission, and does not burn the claim (so a later grant still notifies)', async () => {
    installNotification('default');
    installServiceWorker(null);
    expect(await showReminderNotification('r3:2026-09-19', 'SMRITI', 'x')).toBe('unavailable');
    installNotification('granted');
    expect(await showReminderNotification('r3:2026-09-19', 'SMRITI', 'x')).toBe('shown');
  });
});

describe('getNotifySupport', () => {
  it('is unsupported where the Notification API is missing', () => {
    vi.stubGlobal('Notification', undefined);
    expect(getNotifySupport()).toBe('unsupported');
  });

  it('asks an iPhone browser tab to install the app first (iOS only delivers to installed web apps)', () => {
    installNotification('default');
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', standalone: false });
    expect(getNotifySupport()).toBe('needs-install');
  });

  it('is ready in an ordinary browser', () => {
    installNotification('default');
    expect(getNotifySupport()).toBe('ready');
  });
});

describe('enableReminderNotifications', () => {
  const input = {
    title: 'SMRITI',
    strings: { medication: 'Time for your medicine' },
    language: 'en',
    patientIds: ['p1'],
    deviceTrustTokens: [{ patientId: 'p1', issuedAt: 1, issuedBy: 'u', signature: 's' }],
  };

  it('does not proceed when the person declines, and reports it', async () => {
    installNotification('default', 'denied');
    installServiceWorker(null);
    const res = await enableReminderNotifications(input);
    expect(res.permission).toBe('denied');
    expect(res.push).toBe('unsupported');
    expect(await readNotifyPrefs()).toBeNull();
  });

  it('stores the generic wording for the worker and registers periodic sync where the browser allows it', async () => {
    installNotification('default', 'granted');
    const register = vi.fn(async () => undefined);
    installServiceWorker({ periodicSync: { register }, showNotification: vi.fn() });
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: navigator.serviceWorker, permissions: { query: vi.fn(async () => ({ state: 'granted' })) } });
    const res = await enableReminderNotifications(input);
    expect(res).toMatchObject({ permission: 'granted', periodicSync: true, push: 'not_configured' });
    expect(register).toHaveBeenCalledWith('smriti-reminders', { minInterval: expect.any(Number) });
    expect(await readNotifyPrefs()).toEqual({ language: 'en', title: 'SMRITI', strings: input.strings });
  });

  it('subscribes for Web Push when a public key is configured and posts it with the device-trust tokens', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BAEA';
    installNotification('granted');
    const subscription = { toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } }) };
    const subscribe = vi.fn(async () => subscription);
    installServiceWorker({ pushManager: { getSubscription: vi.fn(async () => null), subscribe } });
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await enableReminderNotifications(input);
    expect(res.push).toBe('subscribed');
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/push/subscribe');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ kind: 'patient_device', language: 'en', deviceTrustTokens: input.deviceTrustTokens });
    expect(body.subscription.endpoint).toBe('https://push.example/1');
  });

  it('never throws when Web Push setup fails; local reminders still work', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BAEA';
    installNotification('granted');
    installServiceWorker({ pushManager: { getSubscription: vi.fn(async () => null), subscribe: vi.fn(async () => { throw new Error('blocked'); }) } });
    await expect(enableReminderNotifications(input)).resolves.toMatchObject({ permission: 'granted', push: 'failed' });
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes url-safe base64 (the VAPID key format)', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });
});
