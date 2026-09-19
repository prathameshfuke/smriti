import { describe, it, expect, vi } from 'vitest';
import { handleNotificationClick } from '@/sw/handlers';

const origin = 'https://smriti.example';
const note = (url?: string) => ({ close: vi.fn(), data: url ? { url } : undefined });

describe('notification click deep link', () => {
  it('opens the patient page in a new window when SMRITI is closed', async () => {
    const clients = { matchAll: async () => [], openWindow: vi.fn(async () => undefined) };
    await handleNotificationClick(note('/caregiver/patients/p1'), clients, origin);
    expect(clients.openWindow).toHaveBeenCalledWith(`${origin}/caregiver/patients/p1`);
  });

  it('focuses AND navigates an already-open window to the patient page', async () => {
    const win = { url: `${origin}/caregiver/dashboard`, focus: vi.fn(async () => undefined), navigate: vi.fn(async () => undefined) };
    const clients = { matchAll: async () => [win], openWindow: vi.fn() };
    await handleNotificationClick(note('/caregiver/patients/p1'), clients, origin);
    expect(win.focus).toHaveBeenCalled();
    expect(win.navigate).toHaveBeenCalledWith(`${origin}/caregiver/patients/p1`);
    expect(clients.openWindow).not.toHaveBeenCalled();
  });

  it('a reminder click (home target) only focuses, as before', async () => {
    const win = { url: `${origin}/app`, focus: vi.fn(async () => undefined), navigate: vi.fn() };
    await handleNotificationClick(note(), { matchAll: async () => [win], openWindow: vi.fn() }, origin);
    expect(win.navigate).not.toHaveBeenCalled();
  });

  it('never navigates off-origin', async () => {
    const win = { url: `${origin}/app`, focus: vi.fn(async () => undefined), navigate: vi.fn() };
    await handleNotificationClick(note('https://evil.example/x'), { matchAll: async () => [win], openWindow: vi.fn() }, origin);
    expect(win.navigate).not.toHaveBeenCalled();
  });
});
