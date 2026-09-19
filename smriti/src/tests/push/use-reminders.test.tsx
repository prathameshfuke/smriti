import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { db } from '@/lib/db/schema';
import { NOTIFY_DB, claimNotification } from '@/lib/push/notifyStore';
import { usePatientStore } from '@/stores/patientStore';
import { useReminders } from '@/hooks/useReminders';

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const patient = { id: 'p1', caregiverId: 'c1', displayName: 'Hari', isActive: true } as never;

function stubNotification(permission: 'default' | 'granted') {
  const ctor = vi.fn();
  Object.assign(ctor, { permission, requestPermission: vi.fn(async () => permission) });
  vi.stubGlobal('Notification', ctor);
  return ctor as unknown as ReturnType<typeof vi.fn> & { requestPermission: ReturnType<typeof vi.fn> };
}

beforeEach(async () => {
  await db.reminderSchedules.clear();
  await db.reminderAcks.clear();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase(NOTIFY_DB);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
  await db.reminderSchedules.put({
    id: 'r1',
    patientId: 'p1',
    reminderType: 'hydration',
    label: 'Drink water',
    timeOfDay: nowHHMM(),
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isActive: true,
    updatedAt: new Date().toISOString(),
  });
  usePatientStore.getState().setCurrentPatient(patient);
});
afterEach(() => vi.unstubAllGlobals());

describe('useReminders keeps its in-app behaviour', () => {
  it('surfaces the due reminder as a card and notifies once with a tag shared with the worker', async () => {
    const N = stubNotification('granted');
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.pendingReminder?.id).toBe('r1'));
    await waitFor(() => expect(N).toHaveBeenCalledTimes(1));
    expect(N).toHaveBeenCalledWith('SMRITI', expect.objectContaining({ tag: `smriti-reminder:r1:${today()}` }));
  });
});

describe('useReminders and the service worker never double-notify', () => {
  it('still shows the card, but stays silent, when the worker already notified this occurrence', async () => {
    const N = stubNotification('granted');
    await claimNotification(`r1:${today()}`);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.pendingReminder?.id).toBe('r1'));
    await new Promise((r) => setTimeout(r, 50));
    expect(N).not.toHaveBeenCalled();
  });

  it('does not ask for permission by itself: that is the opt-in card\'s job (iOS ignores an unprompted request)', async () => {
    const N = stubNotification('default');
    renderHook(() => useReminders());
    await new Promise((r) => setTimeout(r, 50));
    expect(N.requestPermission).not.toHaveBeenCalled();
  });
});
