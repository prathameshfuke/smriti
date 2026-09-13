import { describe, it, expect } from 'vitest';
import type { LocalDailySummary, LocalReminderAck, LocalReminderSchedule } from '@/lib/db/schema';
import {
  aggregateDailyBlended,
  classifyVelocity,
  countSessionDays,
  findAccuracyDrops,
  getTrendState,
  rowsToPoints,
  summaryToPoint,
  type TrendPoint,
} from '@/lib/dashboard/trend';
import { aggregateByGame } from '@/lib/dashboard/gameBreakdown';
import { CANONICAL_GAMES, GAME_LABELS } from '@/lib/dashboard/gameLabels';
import { toAdherenceAck, toAdherenceSchedule } from '@/lib/dashboard/adherenceAdapter';
import { computeStreak } from '@/lib/dashboard/streak';

const summary = (over: Partial<LocalDailySummary> = {}): LocalDailySummary => ({
  id: 'row-1',
  patientId: 'p1',
  summaryDate: '2026-09-01',
  gameType: 'object_hunt',
  totalRounds: 10,
  correctRounds: 8,
  avgResponseTimeMs: 1200,
  maxDifficultyReached: 3,
  sessionCount: 1,
  eloRating: 0,
  synced: false,
  ...over,
});

describe('summaryToPoint / rowsToPoints', () => {
  it('derives accuracy from correctRounds/totalRounds, not a stored field', () => {
    const point = summaryToPoint(summary({ totalRounds: 10, correctRounds: 8 }));
    expect(point.accuracy).toBe(80);
    expect(point.date).toBe('2026-09-01');
    expect(point.gameType).toBe('object_hunt');
    expect(point.maxDifficultyReached).toBe(3);
    expect(point.sessionCount).toBe(1);
    expect(point.totalRounds).toBe(10);
  });

  it('treats a zero-round day as 0% instead of dividing by zero', () => {
    const point = summaryToPoint(summary({ totalRounds: 0, correctRounds: 0 }));
    expect(point.accuracy).toBe(0);
    expect(Number.isFinite(point.accuracy)).toBe(true);
  });

  it('maps every row in a list', () => {
    const points = rowsToPoints([
      summary({ id: 'a', summaryDate: '2026-09-01' }),
      summary({ id: 'b', summaryDate: '2026-09-02' }),
    ]);
    expect(points).toHaveLength(2);
  });

  it('returns an empty array for an empty list', () => {
    expect(rowsToPoints([])).toEqual([]);
  });
});

describe('countSessionDays', () => {
  it('counts distinct calendar days, not rows', () => {
    const points = rowsToPoints([
      summary({ id: 'a', summaryDate: '2026-09-01', gameType: 'object_hunt' }),
      summary({ id: 'b', summaryDate: '2026-09-01', gameType: 'quick_tap' }),
      summary({ id: 'c', summaryDate: '2026-09-02', gameType: 'object_hunt' }),
    ]);
    expect(countSessionDays(points)).toBe(2);
  });

  it('is 0 for an empty list', () => {
    expect(countSessionDays([])).toBe(0);
  });
});

describe('aggregateDailyBlended — rounds-weighted, not an unweighted per-row mean', () => {
  it('weights a 30-round game 10x a 3-round game on the same day', () => {
    const points = rowsToPoints([
      // 3 of 3 correct (100%) on a tiny 3-round game...
      summary({ id: 'a', summaryDate: '2026-09-01', gameType: 'quick_tap', totalRounds: 3, correctRounds: 3 }),
      // ...and 0 of 30 correct (0%) on a full 30-round game, same day.
      summary({ id: 'b', summaryDate: '2026-09-01', gameType: 'object_hunt', totalRounds: 30, correctRounds: 0 }),
    ]);
    const [day] = aggregateDailyBlended(points);
    // Unweighted mean of 100% and 0% would be 50% — rounds-weighted is 3/33.
    expect(day.accuracy).toBeCloseTo((3 / 33) * 100, 5);
    expect(day.totalRounds).toBe(33);
  });

  it('sorts output by date ascending', () => {
    const points = rowsToPoints([
      summary({ id: 'a', summaryDate: '2026-09-03' }),
      summary({ id: 'b', summaryDate: '2026-09-01' }),
      summary({ id: 'c', summaryDate: '2026-09-02' }),
    ]);
    const daily = aggregateDailyBlended(points);
    expect(daily.map((d) => d.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  it('carries the max difficulty reached across every game that day', () => {
    const points = rowsToPoints([
      summary({ id: 'a', summaryDate: '2026-09-01', gameType: 'quick_tap', maxDifficultyReached: 2 }),
      summary({ id: 'b', summaryDate: '2026-09-01', gameType: 'object_hunt', maxDifficultyReached: 7 }),
    ]);
    expect(aggregateDailyBlended(points)[0].maxDifficultyReached).toBe(7);
  });

  it('returns an empty array for no points', () => {
    expect(aggregateDailyBlended([])).toEqual([]);
  });
});

describe('getTrendState', () => {
  it('is "empty" at exactly 0 session days', () => {
    expect(getTrendState(0, 5)).toBe('empty');
  });

  it('is "low-data" between 1 and minSessionsForTrend - 1', () => {
    expect(getTrendState(1, 5)).toBe('low-data');
    expect(getTrendState(4, 5)).toBe('low-data');
  });

  it('is "trend" at or above minSessionsForTrend', () => {
    expect(getTrendState(5, 5)).toBe('trend');
    expect(getTrendState(30, 5)).toBe('trend');
  });
});

describe('findAccuracyDrops', () => {
  it('flags a day-over-day fall of more than 15 points', () => {
    const daily = [
      { date: '2026-09-01', accuracy: 90, totalRounds: 10, sessionCount: 1, maxDifficultyReached: 1 },
      { date: '2026-09-02', accuracy: 60, totalRounds: 10, sessionCount: 1, maxDifficultyReached: 1 },
    ];
    const drops = findAccuracyDrops(daily);
    expect(drops).toHaveLength(1);
    expect(drops[0].date).toBe('2026-09-02');
    expect(drops[0].delta).toBeCloseTo(30, 5);
  });

  it('does not flag a fall of exactly 15 points or less', () => {
    const daily = [
      { date: '2026-09-01', accuracy: 80, totalRounds: 10, sessionCount: 1, maxDifficultyReached: 1 },
      { date: '2026-09-02', accuracy: 65, totalRounds: 10, sessionCount: 1, maxDifficultyReached: 1 },
    ];
    expect(findAccuracyDrops(daily)).toHaveLength(0);
  });

  it('does not flag an improvement', () => {
    const daily = [
      { date: '2026-09-01', accuracy: 40, totalRounds: 10, sessionCount: 1, maxDifficultyReached: 1 },
      { date: '2026-09-02', accuracy: 90, totalRounds: 10, sessionCount: 1, maxDifficultyReached: 1 },
    ];
    expect(findAccuracyDrops(daily)).toHaveLength(0);
  });
});

describe('classifyVelocity', () => {
  const day = (date: string, accuracy: number) => ({
    date,
    accuracy,
    totalRounds: 10,
    sessionCount: 1,
    maxDifficultyReached: 1,
  });

  it('returns null with fewer than 2 full weeks of daily data', () => {
    const daily = Array.from({ length: 5 }, (_, i) => day(`2026-09-0${i + 1}`, 80));
    expect(classifyVelocity(daily)).toBeNull();
  });

  it('reports improving when the last 7 days beat the previous 7 by more than 5 points', () => {
    const prev = Array.from({ length: 7 }, (_, i) => day(`2026-08-2${i + 1}`, 60));
    const last = Array.from({ length: 7 }, (_, i) => day(`2026-09-0${i + 1}`, 80));
    expect(classifyVelocity([...prev, ...last])).toEqual({ label: '↑ Improving', direction: 'up' });
  });

  it('reports declining when the last 7 days fall more than 5 points', () => {
    const prev = Array.from({ length: 7 }, (_, i) => day(`2026-08-2${i + 1}`, 80));
    const last = Array.from({ length: 7 }, (_, i) => day(`2026-09-0${i + 1}`, 60));
    expect(classifyVelocity([...prev, ...last])).toEqual({ label: '↓ Declining', direction: 'down' });
  });

  it('reports stable within a 5-point band', () => {
    const prev = Array.from({ length: 7 }, (_, i) => day(`2026-08-2${i + 1}`, 80));
    const last = Array.from({ length: 7 }, (_, i) => day(`2026-09-0${i + 1}`, 82));
    expect(classifyVelocity([...prev, ...last])).toEqual({ label: '→ Stable', direction: 'stable' });
  });
});

describe('gameLabels', () => {
  it('has a label for every canonical game', () => {
    for (const game of CANONICAL_GAMES) {
      expect(GAME_LABELS[game]).toBeTruthy();
    }
  });

  it('includes reminiscence_quiz, unlike the retired ScoreGraph-only vocabulary', () => {
    expect(CANONICAL_GAMES).toContain('reminiscence_quiz');
    expect(GAME_LABELS.reminiscence_quiz).toBeTruthy();
  });
});

describe('aggregateByGame', () => {
  it('groups rounds-weighted accuracy per game and carries label/maxLevel from the shared sources', () => {
    const points: TrendPoint[] = rowsToPoints([
      summary({ id: 'a', summaryDate: '2026-09-01', gameType: 'object_hunt', totalRounds: 10, correctRounds: 5 }),
      summary({ id: 'b', summaryDate: '2026-09-02', gameType: 'object_hunt', totalRounds: 10, correctRounds: 9 }),
      summary({ id: 'c', summaryDate: '2026-09-01', gameType: 'quick_tap', totalRounds: 4, correctRounds: 4 }),
    ]);
    const rows = aggregateByGame(points);
    const objectHunt = rows.find((r) => r.gameType === 'object_hunt');
    expect(objectHunt?.accuracy).toBeCloseTo(70, 5); // 14/20
    expect(objectHunt?.label).toBe(GAME_LABELS.object_hunt);
    expect(objectHunt?.maxLevel).toBeGreaterThan(0);
    expect(objectHunt?.lastPlayed).toBe('2026-09-02');

    const quickTap = rows.find((r) => r.gameType === 'quick_tap');
    expect(quickTap?.accuracy).toBeCloseTo(100, 5);
  });

  it('returns an empty array for no points', () => {
    expect(aggregateByGame([])).toEqual([]);
  });
});

describe('adherence adapter', () => {
  const schedule: LocalReminderSchedule = {
    id: 's1',
    patientId: 'p1',
    reminderType: 'medication',
    label: 'Aspirin',
    timeOfDay: '08:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isActive: true,
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
  const ack: LocalReminderAck = {
    id: 'ack1',
    reminderId: 's1',
    patientId: 'p1',
    scheduledAt: '2026-09-01T08:00:00.000Z',
    acknowledgedAt: '2026-09-01T08:05:00.000Z',
    ackMethod: 'touch',
    synced: false,
  };

  it('maps camelCase schedule rows to the snake_case shape computeAdherence expects', () => {
    expect(toAdherenceSchedule(schedule)).toEqual({
      id: 's1',
      reminder_type: 'medication',
      time_of_day: '08:00',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      label: 'Aspirin',
    });
  });

  it('maps camelCase ack rows to the snake_case shape computeAdherence expects', () => {
    expect(toAdherenceAck(ack)).toEqual({
      reminder_id: 's1',
      scheduled_at: '2026-09-01T08:00:00.000Z',
      acknowledged_at: '2026-09-01T08:05:00.000Z',
    });
  });

  it('passes a null acknowledged_at through unchanged (never acknowledged)', () => {
    expect(toAdherenceAck({ ...ack, acknowledgedAt: null }).acknowledged_at).toBeNull();
  });
});

describe('computeStreak', () => {
  it('counts back from today through unbroken consecutive days', () => {
    const dates = ['2026-09-10', '2026-09-11', '2026-09-12'];
    expect(computeStreak(dates, '2026-09-12')).toEqual({ current: 3, playedToday: true });
  });

  it('still counts the streak through yesterday when nothing is logged yet today', () => {
    const dates = ['2026-09-10', '2026-09-11'];
    expect(computeStreak(dates, '2026-09-12')).toEqual({ current: 2, playedToday: false });
  });

  it('resets to 0 on any gap, with no grace day', () => {
    const dates = ['2026-09-08', '2026-09-10', '2026-09-11', '2026-09-12'];
    // 2026-09-09 is missing, so the streak can only reach back to the 10th.
    expect(computeStreak(dates, '2026-09-12')).toEqual({ current: 3, playedToday: true });
  });

  it('is 0 when today and yesterday are both unplayed, even with older history', () => {
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03'];
    expect(computeStreak(dates, '2026-09-12')).toEqual({ current: 0, playedToday: false });
  });

  it('is 0 with no history at all', () => {
    expect(computeStreak([], '2026-09-12')).toEqual({ current: 0, playedToday: false });
  });

  it('ignores duplicate dates (multiple games played the same day)', () => {
    const dates = ['2026-09-12', '2026-09-12', '2026-09-11'];
    expect(computeStreak(dates, '2026-09-12')).toEqual({ current: 2, playedToday: true });
  });
});
