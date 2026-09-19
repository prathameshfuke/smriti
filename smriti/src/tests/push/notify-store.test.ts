import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { claimNotification, readNotifyPrefs, writeNotifyPrefs, pruneClaims, NOTIFY_DB } from '@/lib/push/notifyStore';

beforeEach(async () => {
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase(NOTIFY_DB);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
});

describe('notifyStore (shared by the page and the service worker)', () => {
  it('lets exactly one caller claim an occurrence', async () => {
    expect(await claimNotification('r1:2026-09-19')).toBe(true);
    expect(await claimNotification('r1:2026-09-19')).toBe(false);
    expect(await claimNotification('r1:2026-09-20')).toBe(true);
  });

  it('is atomic under concurrent claims', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => claimNotification('r9:2026-09-19')));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('prunes old claims so the store stays small', async () => {
    await claimNotification('old', Date.now() - 5 * 86_400_000);
    await claimNotification('new');
    await pruneClaims();
    expect(await claimNotification('old')).toBe(true);
    expect(await claimNotification('new')).toBe(false);
  });

  it('round-trips notification strings and language, and returns null when never written', async () => {
    expect(await readNotifyPrefs()).toBeNull();
    await writeNotifyPrefs({ language: 'hi', title: 'SMRITI', strings: { medication: 'दवाई' } });
    expect(await readNotifyPrefs()).toEqual({ language: 'hi', title: 'SMRITI', strings: { medication: 'दवाई' } });
  });
});
