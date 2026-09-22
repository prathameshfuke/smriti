import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/lib/db/schema';
import { pickConsolingClipIndex } from '@/lib/engine/mood';

const PATIENT = 'p1';

async function reset() {
  await db.moodLogs.clear();
}

describe('pickConsolingClipIndex', () => {
  beforeEach(reset);

  it('picks something in range when there is no prior day to avoid', async () => {
    const index = await pickConsolingClipIndex(PATIENT, 5);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(5);
  });

  it('never repeats yesterday\'s clip when yesterday was also "low"', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    await db.moodLogs.put({
      id: 'y1',
      patientId: PATIENT,
      date: yesterdayStr,
      value: 'low',
      createdAt: new Date().toISOString(),
      synced: false,
      consolingClipIndex: 2,
    });
    // Run many times: a flaky "sometimes repeats" bug would show up quickly.
    for (let i = 0; i < 30; i += 1) {
      const index = await pickConsolingClipIndex(PATIENT, 5);
      expect(index).not.toBe(2);
    }
  });

  it('ignores a prior "low" day that was not yesterday', async () => {
    await db.moodLogs.put({
      id: 'old1',
      patientId: PATIENT,
      date: '2020-01-01',
      value: 'low',
      createdAt: new Date().toISOString(),
      synced: false,
      consolingClipIndex: 3,
    });
    const seen = new Set<number>();
    for (let i = 0; i < 50; i += 1) seen.add(await pickConsolingClipIndex(PATIENT, 5));
    // With no real "yesterday" to avoid, every index should eventually turn up.
    expect(seen.has(3)).toBe(true);
  });

  it('ignores yesterday when it was not "low" (a good/okay day has nothing to avoid repeating)', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    await db.moodLogs.put({
      id: 'y2',
      patientId: PATIENT,
      date: yesterdayStr,
      value: 'good',
      createdAt: new Date().toISOString(),
      synced: false,
    });
    const seen = new Set<number>();
    for (let i = 0; i < 50; i += 1) seen.add(await pickConsolingClipIndex(PATIENT, 5));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('always returns 0 for a single-clip set (nothing to rotate)', async () => {
    expect(await pickConsolingClipIndex(PATIENT, 1)).toBe(0);
  });
});
