import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import {
  computeFeatures,
  predictDifficultyClass,
  CONFIDENCE_THRESHOLD,
  type DifficultyFeatures,
} from '@/lib/games/difficulty-ml';
import { adjustDifficulty, type DifficultyState } from '@/lib/engine/difficulty';
import type { LocalTelemetryEvent } from '@/lib/db/schema';

function event(over: Partial<LocalTelemetryEvent> = {}): LocalTelemetryEvent {
  return {
    id: uuid(),
    sessionId: 's1',
    patientId: 'p1',
    gameType: 'object_hunt',
    difficultyLevel: 3,
    roundNumber: 1,
    isCorrect: true,
    responseTimeMs: 1200,
    eventTimestamp: new Date().toISOString(),
    metadata: {},
    synced: false,
    ...over,
  };
}

describe('computeFeatures', () => {
  it('returns null for an empty session', () => {
    expect(computeFeatures([])).toBeNull();
  });

  it('derives all 5 features from round telemetry', () => {
    const events = [
      event({ isCorrect: true, responseTimeMs: 1000, roundNumber: 1 }),
      event({ isCorrect: true, responseTimeMs: 1100, roundNumber: 2 }),
      event({ isCorrect: false, responseTimeMs: 2000, roundNumber: 3 }),
      event({ isCorrect: false, responseTimeMs: 2200, roundNumber: 4 }),
    ];
    const features = computeFeatures(events);
    expect(features).not.toBeNull();
    expect(features!.errorStreak).toBe(2);
    expect(features!.domainAccuracy).toBeCloseTo(0.5);
    expect(features!.rollingAccuracy).toBeCloseTo(0.5);
    expect(features!.sessionFatigue).toBeCloseTo(4 / 20);
    expect(Number.isFinite(features!.reactionTimeZScore)).toBe(true);
  });
});

describe('predictDifficultyClass', () => {
  it('returns a class in {decrease, maintain, increase} and a confidence in [0,1]', () => {
    const features: DifficultyFeatures = {
      rollingAccuracy: 0.9,
      reactionTimeZScore: -0.5,
      errorStreak: 0,
      domainAccuracy: 0.9,
      sessionFatigue: 0.5,
    };
    const result = predictDifficultyClass(features);
    expect(['decrease', 'maintain', 'increase']).toContain(result.predictedClass);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('runs in well under 5ms per call', () => {
    const features: DifficultyFeatures = {
      rollingAccuracy: 0.7,
      reactionTimeZScore: 0.2,
      errorStreak: 1,
      domainAccuracy: 0.7,
      sessionFatigue: 0.8,
    };
    const start = performance.now();
    predictDifficultyClass(features);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5);
  });

  it('a strongly accurate, non-fatigued, error-free session predicts increase with meaningful confidence', () => {
    const features: DifficultyFeatures = {
      rollingAccuracy: 1,
      reactionTimeZScore: -1,
      errorStreak: 0,
      domainAccuracy: 1,
      sessionFatigue: 0.2,
    };
    const result = predictDifficultyClass(features);
    expect(result.predictedClass).toBe('increase');
    expect(result.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLD);
  });
});

describe('no network calls in the difficulty ML path', () => {
  const originalFetch = global.fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('never calls fetch during feature extraction or prediction', () => {
    const events = [event(), event({ isCorrect: false })];
    const features = computeFeatures(events)!;
    predictDifficultyClass(features);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('adjustDifficulty drop-in compatibility', () => {
  const state = (over: Partial<DifficultyState> = {}): DifficultyState => ({
    currentLevel: 3,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
    ...over,
  });

  it('with no sessionEvents argument, matches the pre-existing rule-based behavior exactly', () => {
    let s = state({ currentLevel: 3 });
    s = adjustDifficulty(s, 'object_hunt', 85);
    s = adjustDifficulty(s, 'object_hunt', 90);
    expect(s.currentLevel).toBe(3);
    s = adjustDifficulty(s, 'object_hunt', 82);
    expect(s.currentLevel).toBe(4);
  });

  it('with a single/empty sessionEvents array (low signal), still falls back to rule-based behavior', () => {
    let s = state({ currentLevel: 3 });
    s = adjustDifficulty(s, 'object_hunt', 85, []);
    s = adjustDifficulty(s, 'object_hunt', 90, []);
    expect(s.currentLevel).toBe(3);
    s = adjustDifficulty(s, 'object_hunt', 82, []);
    expect(s.currentLevel).toBe(4);
  });

  it('never exceeds the per-game max level or drops below 1, on either path', () => {
    let low = state({ currentLevel: 1 });
    low = adjustDifficulty(low, 'object_hunt', 10);
    low = adjustDifficulty(low, 'object_hunt', 10);
    expect(low.currentLevel).toBe(1);

    const richEvents: LocalTelemetryEvent[] = Array.from({ length: 10 }, (_, i) =>
      event({ isCorrect: true, responseTimeMs: 800, roundNumber: i + 1 }),
    );
    let high = state({ currentLevel: 10 });
    high = adjustDifficulty(high, 'object_hunt', 100, richEvents);
    expect(high.currentLevel).toBeLessThanOrEqual(10);
  });

  it('with a confidently strong single session, the ML path levels up immediately — no 3-session streak required', () => {
    // Fast, accurate, no errors, not fatigued: matches the confidently
    // "increase"-predicting feature region verified in predictDifficultyClass's
    // own test above. The rule-based fallback would need 3 such sessions in a
    // row to do the same; this is the actual behavioral upside of the ML path.
    const strongEvents: LocalTelemetryEvent[] = Array.from({ length: 6 }, (_, i) =>
      event({ isCorrect: true, responseTimeMs: 700 - i * 5, roundNumber: i + 1 }),
    );
    const single = adjustDifficulty(state({ currentLevel: 3 }), 'object_hunt', 100, strongEvents);
    expect(single.currentLevel).toBe(4);
  });
});
