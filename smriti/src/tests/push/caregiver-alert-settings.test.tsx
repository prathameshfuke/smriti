import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const { authedFetch } = vi.hoisted(() => ({ authedFetch: vi.fn(async () => ({ ok: true })) }));
vi.mock('@/lib/api/client', () => ({ authedFetch }));

import CaregiverAlertSettings from '@/components/caregiver/CaregiverAlertSettings';
import { I18nProvider } from '@/lib/i18n/provider';

const wrap = (n: ReactNode) => <I18nProvider>{n}</I18nProvider>;

let current: { endpoint: string; toJSON: () => unknown; unsubscribe: ReturnType<typeof vi.fn> } | null;
const subscribe = vi.fn();

function stubBrowser(permission: 'default' | 'granted' | 'denied') {
  const Notif = Object.assign(vi.fn(), {
    permission,
    requestPermission: vi.fn(async () => {
      Notif.permission = 'granted';
      return 'granted';
    }),
  });
  vi.stubGlobal('Notification', Notif);
  const reg = { pushManager: { getSubscription: async () => current, subscribe } };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => reg, ready: Promise.resolve(reg) },
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BPZ1';
  authedFetch.mockClear();
  authedFetch.mockResolvedValue({ ok: true });
  current = null;
  subscribe.mockReset().mockImplementation(async () => {
    current = {
      endpoint: 'https://push.example/x',
      toJSON: () => ({ endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' } }),
      unsubscribe: vi.fn(async () => ((current = null), true)),
    };
    return current;
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
});

describe('CaregiverAlertSettings', () => {
  it('asks only on tap, then registers this browser as a caregiver phone and shows "on"', async () => {
    stubBrowser('default');
    render(wrap(<CaregiverAlertSettings />));
    const button = await screen.findByRole('button', { name: 'Turn on alerts' });
    expect(authedFetch).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(await screen.findByText('Alerts are on for this phone.')).toBeInTheDocument();
    const [path, init] = authedFetch.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(path).toBe('/api/push/subscribe');
    expect(JSON.parse(init.body)).toMatchObject({ kind: 'caregiver', subscription: { endpoint: 'https://push.example/x' } });
    expect(screen.getByRole('button', { name: 'Turn off alerts' })).toBeInTheDocument();
  });

  it('turns alerts off: removes the server row and the browser subscription', async () => {
    stubBrowser('granted');
    await subscribe();
    render(wrap(<CaregiverAlertSettings />));
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off alerts' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn on alerts' })).toBeInTheDocument());
    const [, init] = authedFetch.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ endpoint: 'https://push.example/x' });
  });

  it('explains how to unblock, and shows nothing actionable, when blocked', async () => {
    stubBrowser('denied');
    render(wrap(<CaregiverAlertSettings />));
    expect(await screen.findByText(/Notifications are blocked/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('tells the caregiver to use their own phone when this browser already shows patient reminders (409)', async () => {
    stubBrowser('granted');
    authedFetch.mockRejectedValue(new Error('Request to /api/push/subscribe failed with status 409'));
    render(wrap(<CaregiverAlertSettings />));
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on alerts' }));
    expect(await screen.findByText(/Use your own phone/)).toBeInTheDocument();
  });

  it('says so when the server has no push keys (503)', async () => {
    stubBrowser('granted');
    authedFetch.mockRejectedValue(new Error('Request to /api/push/subscribe failed with status 503'));
    render(wrap(<CaregiverAlertSettings />));
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on alerts' }));
    expect(await screen.findByText('Alerts are not set up on this server yet.')).toBeInTheDocument();
  });

  it('says the browser cannot show notifications where they do not exist', async () => {
    vi.stubGlobal('Notification', undefined);
    render(wrap(<CaregiverAlertSettings />));
    expect(await screen.findByText('This browser cannot show notifications.')).toBeInTheDocument();
  });
});
