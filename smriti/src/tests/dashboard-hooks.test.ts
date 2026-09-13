import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { db, SmritiDB, type LocalDailySummary, type LocalReminderAck, type LocalReminderSchedule } from '@/lib/db/schema';
import { useCognitiveTrend } from '@/hooks/useCognitiveTrend';
import { useGameStreak } from '@/hooks/useGameStreak';
import { useReminderAdherence } from '@/hooks/useReminderAdherence';
import { dateRange } from '@/lib/engine/adherence';

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const summaryRow = (over: Partial<LocalDailySummary> = {}): LocalDailySummary => ({
  id: `row-${Math.random()}`,
  patientId: 'p1',
  summaryDate: isoDaysAgo(0),
  gameType: 'object_hunt',
  totalRounds: 10,
  correctRounds: 8,
  avgResponseTimeMs: 1000,
  maxDifficultyReached: 3,
  sessionCount: 1,
  eloRating: 0,
  synced: false,
  ...over,
});

beforeEach(async () => {
  await db.dailySummaries.clear();
  await db.reminderSchedules.clear();
  await db.reminderAcks.clear();
});

afterEach(async () => {
  await SmritiDB.deleteDatabase().catch(() => undefined);
});

describe('useCognitiveTrend', () => {
  it('starts loading, then resolves to empty when Dexie has no rows for the patient', async () => {
    const { result } = renderHook(() => useCognitiveTrend('p1', '30d'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.points).toEqual([]);
    expect(result.current.sessionDays).toBe(0);
  });

  it('reads rows for the given patient within the selected range from Dexie only', async () => {
    await db.dailySummaries.bulkAdd([
      summaryRow({ id: 'a', patientId: 'p1', summaryDate: isoDaysAgo(1) }),
      summaryRow({ id: 'b', patientId: 'p1', summaryDate: isoDaysAgo(2), gameType: 'quick_tap' }),
      // A different patient's row must never leak into p1's trend.
      summaryRow({ id: 'c', patientId: 'p2', summaryDate: isoDaysAgo(1) }),
    ]);

    const { result } = renderHook(() => useCognitiveTrend('p1', '30d'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.points).toHaveLength(2);
    expect(result.current.sessionDays).toBe(2);
    expect(result.current.points.every((p) => p.gameType !== undefined)).toBe(true);
  });

  it('excludes rows older than the selected range window', async () => {
    await db.dailySummaries.bulkAdd([
      summaryRow({ id: 'recent', patientId: 'p1', summaryDate: isoDaysAgo(5) }),
      summaryRow({ id: 'ancient', patientId: 'p1', summaryDate: isoDaysAgo(200) }),
    ]);

    const { result } = renderHook(() => useCognitiveTrend('p1', '30d'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.points.map((p) => p.date)).toEqual([isoDaysAgo(5)]);
  });

  it('returns empty immediately (loading resolves to false) when patientId is null', async () => {
    const { result } = renderHook(() => useCognitiveTrend(null, '30d'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.points).toEqual([]);
    expect(result.current.sessionDays).toBe(0);
  });

  it('resolves real data from Dexie even when every network call fails and the browser reports offline', async () => {
    const originalFetch = globalThis.fetch;
    const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network unavailable — offline'));
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });

    try {
      await db.dailySummaries.bulkAdd([
        summaryRow({ id: 'offline-a', patientId: 'p1', summaryDate: isoDaysAgo(1) }),
        summaryRow({ id: 'offline-b', patientId: 'p1', summaryDate: isoDaysAgo(2) }),
      ]);

      const { result } = renderHook(() => useCognitiveTrend('p1', '30d'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.sessionDays).toBe(2);
      expect(result.current.points).toHaveLength(2);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      if (originalOnLine) Object.defineProperty(window.navigator, 'onLine', originalOnLine);
    }
  });
});

describe('useGameStreak', () => {
  it('starts loading, then resolves to 0/not-played-today when Dexie has no rows', async () => {
    const { result } = renderHook(() => useGameStreak('p1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.current).toBe(0);
    expect(result.current.playedToday).toBe(false);
  });

  it('counts consecutive days ending today from real Dexie rows', async () => {
    await db.dailySummaries.bulkAdd([
      summaryRow({ id: 'a', patientId: 'p1', summaryDate: isoDaysAgo(0) }),
      summaryRow({ id: 'b', patientId: 'p1', summaryDate: isoDaysAgo(1), gameType: 'quick_tap' }),
      summaryRow({ id: 'c', patientId: 'p1', summaryDate: isoDaysAgo(2) }),
    ]);

    const { result } = renderHook(() => useGameStreak('p1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.current).toBe(3);
    expect(result.current.playedToday).toBe(true);
  });

  it('never leaks another patient\'s rows into the streak', async () => {
    await db.dailySummaries.bulkAdd([
      summaryRow({ id: 'mine', patientId: 'p1', summaryDate: isoDaysAgo(0) }),
      summaryRow({ id: 'theirs', patientId: 'p2', summaryDate: isoDaysAgo(0) }),
    ]);

    const { result } = renderHook(() => useGameStreak('p1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.current).toBe(1);
  });

  it('returns 0 immediately (loading resolves to false) when patientId is null', async () => {
    const { result } = renderHook(() => useGameStreak(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.current).toBe(0);
  });
});

describe('useReminderAdherence', () => {
  const scheduleRow = (over: Partial<LocalReminderSchedule> = {}): LocalReminderSchedule => ({
    id: 's1',
    patientId: 'p1',
    reminderType: 'medication',
    label: 'Aspirin',
    timeOfDay: '00:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isActive: true,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  });

  it('resolves to 0% with no schedules', async () => {
    const { result } = renderHook(() => useReminderAdherence('p1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overallPct).toBe(0);
    expect(result.current.missed).toEqual([]);
  });

  it('computes 100% when every expected occurrence in the last 7 days was acknowledged', async () => {
    await db.reminderSchedules.add(scheduleRow());
    const days = dateRange(7);
    const acks: LocalReminderAck[] = days.map((date, i) => ({
      id: `ack-${i}`,
      reminderId: 's1',
      patientId: 'p1',
      scheduledAt: `${date}T00:00:00.000Z`,
      acknowledgedAt: `${date}T00:05:00.000Z`,
      ackMethod: 'touch',
      synced: false,
    }));
    await db.reminderAcks.bulkAdd(acks);

    const { result } = renderHook(() => useReminderAdherence('p1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.overallPct).toBe(100);
    expect(result.current.missed).toEqual([]);
    expect(result.current.byType.medication).toEqual({ acked: 7, total: 7 });
  });

  it('reports unacknowledged occurrences as missed', async () => {
    await db.reminderSchedules.add(scheduleRow());
    // No acks at all -> every expected occurrence this week is missed.
    const { result } = renderHook(() => useReminderAdherence('p1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.overallPct).toBe(0);
    expect(result.current.missed.length).toBeGreaterThan(0);
  });

  it('ignores an inactive schedule', async () => {
    await db.reminderSchedules.add(scheduleRow({ isActive: false }));
    const { result } = renderHook(() => useReminderAdherence('p1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.missed).toEqual([]);
    expect(result.current.byType).toEqual({});
  });
});
