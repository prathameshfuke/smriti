import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const { enable } = vi.hoisted(() => ({
  enable: vi.fn(async () => ({ permission: 'granted' as const, push: 'subscribed' as const, periodicSync: false })),
}));
vi.mock('@/lib/push/client', async (orig) => ({ ...(await orig<typeof import('@/lib/push/client')>()), enableReminderNotifications: enable }));

import NotificationOptIn from '@/components/ui/NotificationOptIn';
import { I18nProvider } from '@/lib/i18n/provider';

const wrap = (n: ReactNode) => <I18nProvider>{n}</I18nProvider>;

function stubNotification(permission: 'default' | 'granted' | 'denied') {
  vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission, requestPermission: vi.fn() }));
}

beforeEach(() => {
  enable.mockClear();
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('NotificationOptIn', () => {
  it('explains in plain words and only asks for permission when the button is tapped', async () => {
    stubNotification('default');
    render(wrap(<NotificationOptIn />));
    expect(await screen.findByText('Get reminders even when SMRITI is closed')).toBeInTheDocument();
    expect(enable).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on reminders' }));
    await waitFor(() => expect(enable).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/You will be told even when SMRITI is closed/)).toBeInTheDocument();
  });

  it('remembers "Not now"', async () => {
    stubNotification('default');
    const first = render(wrap(<NotificationOptIn />));
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('notification-optin')).toBeNull();
    first.unmount();
    render(wrap(<NotificationOptIn />));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('notification-optin')).toBeNull();
  });

  it('shows nothing once permission is granted, and nothing where notifications do not exist', async () => {
    stubNotification('granted');
    const a = render(wrap(<NotificationOptIn />));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('notification-optin')).toBeNull();
    a.unmount();
    vi.stubGlobal('Notification', undefined);
    render(wrap(<NotificationOptIn />));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('notification-optin')).toBeNull();
  });

  it('says how to unblock when the browser has blocked notifications', async () => {
    stubNotification('denied');
    render(wrap(<NotificationOptIn />));
    expect(await screen.findByText(/Notifications are blocked/)).toBeInTheDocument();
  });
});
