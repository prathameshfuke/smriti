import { describe, it, expect } from 'vitest';
import { computeCognitiveScore, recentActivity, scoreBand, shiftDate, type ScoreRow } from '@/lib/dashboard/cognitiveScore';

const TODAY = '2026-09-14';

const row = (daysAgo: number, over: Partial<ScoreRow> = {}): ScoreRow => ({
  date: shiftDate(TODAY, -daysAgo),
  gameType: 'object_hunt',
  correctRounds: 8,
  totalRounds: 10,
  maxDifficultyReached: 5,
  ...over,
});

describe('computeCognitiveScore', () => {
  it('returns null when nothing was played in the window', () => {
    expect(computeCognitiveScore([], TODAY)).toBeNull();
    expect(computeCognitiveScore([row(20)], TODAY)).toBeNull();
  });

  it('blends accuracy, level and regular play 60/25/15', () => {
    // 10 days played at 80% accuracy, object_hunt level 5 of 10.
    const rows = Array.from({ length: 10 }, (_, i) => row(i));
    const result = computeCognitiveScore(rows, TODAY)!;
    expect(result.accuracy).toBeCloseTo(80);
    expect(result.level).toBeCloseTo(50);
    expect(result.regularity).toBe(100);
    expect(result.score).toBe(Math.round(0.6 * 80 + 0.25 * 50 + 0.15 * 100));
    expect(result.enoughData).toBe(true);
    expect(result.band).toBe('steady');
  });

  it('weights accuracy by rounds, not by row', () => {
    const rows = [row(0, { correctRounds: 3, totalRounds: 3 }), row(1, { correctRounds: 0, totalRounds: 30 })];
    expect(computeCognitiveScore(rows, TODAY)!.accuracy).toBeCloseTo((3 / 33) * 100);
  });

  it('marks a score from fewer than 3 days as an early estimate', () => {
    expect(computeCognitiveScore([row(0), row(1)], TODAY)!.enoughData).toBe(false);
  });

  it('reports the change against the previous fortnight', () => {
    const previous = Array.from({ length: 5 }, (_, i) => row(15 + i, { correctRounds: 5 }));
    const current = Array.from({ length: 5 }, (_, i) => row(i, { correctRounds: 9 }));
    const result = computeCognitiveScore([...previous, ...current], TODAY)!;
    expect(result.previousScore).not.toBeNull();
    expect(result.delta).toBe(result.score - result.previousScore!);
    expect(result.delta!).toBeGreaterThan(0);
  });

  it('leaves unlevelled games out of the level component', () => {
    const result = computeCognitiveScore([row(0, { gameType: 'reminiscence_quiz', maxDifficultyReached: 1 })], TODAY)!;
    expect(result.level).toBeCloseTo(result.accuracy);
  });
});

describe('scoreBand', () => {
  it.each([
    [85, 'strong'],
    [60, 'steady'],
    [45, 'support'],
    [10, 'close-support'],
  ] as const)('%i is %s', (score, band) => {
    expect(scoreBand(score)).toBe(band);
  });
});

describe('recentActivity', () => {
  it('returns one entry per day, oldest first, null on days not played', () => {
    const days = recentActivity([row(0), row(2, { correctRounds: 5 })], TODAY);
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual({ date: TODAY, accuracy: 80 });
    expect(days[5].accuracy).toBeNull();
    expect(days[4].accuracy).toBeCloseTo(50);
  });
});
