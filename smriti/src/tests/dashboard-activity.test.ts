import { describe, it, expect } from 'vitest';
import {
  INACTIVITY_ALERT_DAYS,
  aggregateByDomain,
  challengeFit,
  difficultyTrend,
  summarizeActivityLevel,
} from '@/lib/dashboard/activity';
import type { TrendPoint } from '@/lib/dashboard/trend';
import type { GameType } from '@/lib/supabase/types';

function point(over: Partial<TrendPoint> & { date: string }): TrendPoint {
  return {
    accuracy: 80,
    gameType: 'object_hunt' as GameType,
    maxDifficultyReached: 3,
    sessionCount: 1,
    totalRounds: 10,
    ...over,
  };
}

const TODAY = '2026-09-20';

describe('summarizeActivityLevel', () => {
  it('counts sessions and rounds per day across the window', () => {
    const summary = summarizeActivityLevel(
      [
        point({ date: '2026-09-19', sessionCount: 2, totalRounds: 12 }),
        point({ date: '2026-09-19', gameType: 'memory_match', sessionCount: 1, totalRounds: 6 }),
        point({ date: '2026-09-20', sessionCount: 1, totalRounds: 4 }),
      ],
      TODAY,
      14,
    );

    expect(summary.days).toHaveLength(14);
    expect(summary.totalSessions).toBe(4);
    expect(summary.totalRounds).toBe(22);
    expect(summary.daysPlayed).toBe(2);
    expect(summary.days.at(-1)).toMatchObject({ date: '2026-09-20', sessions: 1, rounds: 4 });
  });

  it('reports a full window of nothing as never played', () => {
    const summary = summarizeActivityLevel([], TODAY, 14);
    expect(summary.daysPlayed).toBe(0);
    expect(summary.daysSinceLastPlayed).toBeNull();
    expect(summary.averageRoundsPerDay).toBe(0);
  });

  it('counts the days since the last day played, so a quiet stretch is visible', () => {
    const summary = summarizeActivityLevel([point({ date: '2026-09-14' })], TODAY, 14);
    expect(summary.daysSinceLastPlayed).toBe(6);
    expect(summary.daysSinceLastPlayed).toBeGreaterThan(INACTIVITY_ALERT_DAYS);
  });

  it('ignores days outside the window instead of counting them as recent', () => {
    const summary = summarizeActivityLevel([point({ date: '2026-08-01', totalRounds: 50 })], TODAY, 14);
    expect(summary.totalRounds).toBe(0);
    expect(summary.daysSinceLastPlayed).toBeNull();
  });
});

describe('difficultyTrend', () => {
  it('carries each level as a share of that game’s own cap, since levels are not comparable', () => {
    const trend = difficultyTrend([
      point({ date: '2026-09-18', gameType: 'n_back', maxDifficultyReached: 5 }),
      point({ date: '2026-09-19', gameType: 'object_hunt', maxDifficultyReached: 5 }),
    ]);

    // N-Back caps at 5, Object Hunt at 10: the same raw number, half the reach.
    expect(trend.find((p) => p.gameType === 'n_back')?.levelShare).toBe(1);
    expect(trend.find((p) => p.gameType === 'object_hunt')?.levelShare).toBe(0.5);
  });

  it('leaves out games that have no levels at all', () => {
    const trend = difficultyTrend([point({ date: '2026-09-19', gameType: 'reminiscence_quiz' })]);
    expect(trend).toEqual([]);
  });

  it('comes back in date order', () => {
    const trend = difficultyTrend([point({ date: '2026-09-19' }), point({ date: '2026-09-17' })]);
    expect(trend.map((p) => p.date)).toEqual(['2026-09-17', '2026-09-19']);
  });
});

describe('aggregateByDomain', () => {
  it('groups games into the part of thinking they exercise, weighted by rounds', () => {
    const rows = aggregateByDomain([
      point({ date: '2026-09-19', gameType: 'memory_match', accuracy: 90, totalRounds: 10 }),
      point({ date: '2026-09-19', gameType: 'memory_span', accuracy: 50, totalRounds: 30 }),
      point({ date: '2026-09-19', gameType: 'quick_tap', accuracy: 70, totalRounds: 10 }),
    ]);

    const memory = rows.find((r) => r.domain === 'memory')!;
    expect(memory.gamesPlayed).toBe(2);
    expect(memory.totalRounds).toBe(40);
    // (0.9*10 + 0.5*30) / 40 = 60%, not the 70% a plain average would give.
    expect(Math.round(memory.accuracy)).toBe(60);
    expect(rows.find((r) => r.domain === 'speed')?.accuracy).toBe(70);
  });

  it('leaves out a domain with nothing played rather than showing it at zero', () => {
    const rows = aggregateByDomain([point({ date: '2026-09-19', gameType: 'memory_match' })]);
    expect(rows.map((r) => r.domain)).toEqual(['memory']);
  });

  it('puts the most-played domain first', () => {
    const rows = aggregateByDomain([
      point({ date: '2026-09-19', gameType: 'quick_tap', totalRounds: 5 }),
      point({ date: '2026-09-19', gameType: 'memory_match', totalRounds: 25 }),
    ]);
    expect(rows[0].domain).toBe('memory');
  });
});

describe('challengeFit', () => {
  it('calls a patient who is getting almost everything right under-challenged', () => {
    expect(challengeFit([point({ date: TODAY, accuracy: 96 })]).fit).toBe('too-easy');
  });

  it('calls a patient who is mostly failing over-challenged', () => {
    expect(challengeFit([point({ date: TODAY, accuracy: 40 })]).fit).toBe('too-hard');
  });

  it('calls the target band about right', () => {
    expect(challengeFit([point({ date: TODAY, accuracy: 78 })]).fit).toBe('about-right');
  });

  it('says nothing at all with no data', () => {
    expect(challengeFit([])).toEqual({ fit: 'unknown', accuracy: null });
  });
});
