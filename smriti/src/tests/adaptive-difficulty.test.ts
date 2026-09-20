import { describe, it, expect } from 'vitest';
import { v4 as uuid } from 'uuid';
import {
  decideNextLevel,
  TARGET_ACCURACY_MIN,
  TARGET_ACCURACY_MAX,
  type CognitiveProfile,
} from '@/lib/engine/adaptive';
import type { DifficultyState } from '@/lib/engine/difficulty';
import type { LocalTelemetryEvent } from '@/lib/db/schema';

function state(over: Partial<DifficultyState> = {}): DifficultyState {
  return { currentLevel: 4, consecutiveHighScores: 0, consecutiveLowScores: 0, ...over };
}

function profile(over: Partial<CognitiveProfile> = {}): CognitiveProfile {
  return { band: 'steady', educationYears: 10, ...over };
}

function events(count: number, correctRatio: number, responseTimeMs = 1200): LocalTelemetryEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uuid(),
    sessionId: 's1',
    patientId: 'p1',
    gameType: 'object_hunt' as const,
    difficultyLevel: 4,
    roundNumber: i + 1,
    isCorrect: i < Math.round(count * correctRatio),
    responseTimeMs,
    eventTimestamp: new Date().toISOString(),
    metadata: {},
    synced: false,
  }));
}

describe('decideNextLevel', () => {
  it('never moves more than one level in a single session', () => {
    const result = decideNextLevel({
      state: state({ currentLevel: 2 }),
      gameType: 'object_hunt',
      sessionAccuracy: 100,
      sessionEvents: events(10, 1),
      profile: profile(),
    });
    expect(Math.abs(result.next.currentLevel - 2)).toBeLessThanOrEqual(1);
  });

  it('holds the level for a close-support patient unless the session was near perfect', () => {
    const result = decideNextLevel({
      state: state(),
      gameType: 'object_hunt',
      sessionAccuracy: 86,
      sessionEvents: events(10, 0.86),
      profile: profile({ band: 'close-support' }),
    });
    expect(result.next.currentLevel).toBe(4);
    expect(result.source).toBe('guard');
    expect(result.reason).toMatch(/close support/i);
  });

  it('still lets a close-support patient move up after a near-perfect session', () => {
    const result = decideNextLevel({
      state: state({ consecutiveHighScores: 2 }),
      gameType: 'object_hunt',
      sessionAccuracy: 100,
      sessionEvents: events(10, 1),
      profile: profile({ band: 'close-support' }),
    });
    expect(result.next.currentLevel).toBe(5);
  });

  it('never blocks a step down, whatever the band', () => {
    const result = decideNextLevel({
      state: state({ consecutiveLowScores: 1 }),
      gameType: 'object_hunt',
      sessionAccuracy: 20,
      sessionEvents: events(10, 0.2),
      profile: profile({ band: 'close-support' }),
    });
    expect(result.next.currentLevel).toBe(3);
  });

  it('gives a patient with little schooling the same accuracy bonus the scoring uses', () => {
    const low = decideNextLevel({
      state: state(),
      gameType: 'object_hunt',
      sessionAccuracy: 69,
      profile: profile({ educationYears: 2 }),
    });
    const high = decideNextLevel({
      state: state(),
      gameType: 'object_hunt',
      sessionAccuracy: 69,
      profile: profile({ educationYears: 16 }),
    });
    // 69% + 2 lands inside the target band, so the level holds; 69% alone
    // sits below it and eases the patient back a level.
    expect(low.next.currentLevel).toBe(4);
    expect(high.next.currentLevel).toBe(3);
  });

  it('explains every decision in words a caregiver can read', () => {
    const result = decideNextLevel({
      state: state(),
      gameType: 'object_hunt',
      sessionAccuracy: 75,
      profile: profile(),
    });
    expect(result.reason.length).toBeGreaterThan(0);
    expect(['model', 'rule', 'guard']).toContain(result.source);
  });

  it('stays inside the game cap and floor', () => {
    const top = decideNextLevel({
      state: state({ currentLevel: 10, consecutiveHighScores: 2 }),
      gameType: 'object_hunt',
      sessionAccuracy: 100,
      profile: profile(),
    });
    expect(top.next.currentLevel).toBe(10);

    const bottom = decideNextLevel({
      state: state({ currentLevel: 1, consecutiveLowScores: 1 }),
      gameType: 'object_hunt',
      sessionAccuracy: 10,
      profile: profile(),
    });
    expect(bottom.next.currentLevel).toBe(1);
  });
});

/**
 * The point of adapting at all: a patient should end up playing at a level
 * that is neither trivial nor defeating. This simulates a patient whose
 * ability sits at level 5 — accuracy falls as the level rises above it —
 * and checks the loop settles them into the target band quickly.
 */
describe('convergence on the target accuracy band', () => {
  function simulatedAccuracy(level: number, ability: number): number {
    return Math.max(5, Math.min(100, 100 - (level - ability) * 18));
  }

  it('brings a patient starting far too low into the target band within 5 sessions', () => {
    const ability = 5;
    let current = state({ currentLevel: 1 });
    let accuracy = simulatedAccuracy(current.currentLevel, ability);

    for (let session = 0; session < 5; session += 1) {
      accuracy = simulatedAccuracy(current.currentLevel, ability);
      current = decideNextLevel({
        state: current,
        gameType: 'object_hunt',
        sessionAccuracy: accuracy,
        sessionEvents: events(10, accuracy / 100),
        profile: profile(),
      }).next;
    }

    accuracy = simulatedAccuracy(current.currentLevel, ability);
    expect(accuracy).toBeGreaterThanOrEqual(TARGET_ACCURACY_MIN);
    expect(accuracy).toBeLessThanOrEqual(TARGET_ACCURACY_MAX);
  });

  it('brings a patient starting far too high back into the target band within 5 sessions', () => {
    const ability = 3;
    let current = state({ currentLevel: 9 });
    let accuracy = simulatedAccuracy(current.currentLevel, ability);

    for (let session = 0; session < 5; session += 1) {
      accuracy = simulatedAccuracy(current.currentLevel, ability);
      current = decideNextLevel({
        state: current,
        gameType: 'object_hunt',
        sessionAccuracy: accuracy,
        sessionEvents: events(10, accuracy / 100),
        profile: profile(),
      }).next;
    }

    accuracy = simulatedAccuracy(current.currentLevel, ability);
    expect(accuracy).toBeGreaterThanOrEqual(TARGET_ACCURACY_MIN);
    expect(accuracy).toBeLessThanOrEqual(TARGET_ACCURACY_MAX);
  });

  it('leaves a patient already in the band where they are', () => {
    const before = state({ currentLevel: 5 });
    const after = decideNextLevel({
      state: before,
      gameType: 'object_hunt',
      sessionAccuracy: 78,
      sessionEvents: events(10, 0.78),
      profile: profile(),
    }).next;
    expect(after.currentLevel).toBe(5);
  });
});
