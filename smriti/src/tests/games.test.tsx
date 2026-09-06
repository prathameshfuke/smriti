import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';
import { adjustDifficulty, getEducationBonus, type DifficultyState } from '@/lib/engine/difficulty';
import { logEvent } from '@/lib/engine/telemetry';
import { OBJECTS } from '@/lib/engine/objects';
import { db } from '@/lib/db/schema';
import { useGameStore } from '@/stores/gameStore';
import ObjectGrid from '@/components/games/ObjectGrid';
import MemoryGrid, { type MemoryTile } from '@/components/games/MemoryGrid';

const state = (over: Partial<DifficultyState> = {}): DifficultyState => ({
  currentLevel: 3,
  consecutiveHighScores: 0,
  consecutiveLowScores: 0,
  ...over,
});

describe('adjustDifficulty', () => {
  it('increases level after 3 consecutive sessions above 80% accuracy', () => {
    let s = state({ currentLevel: 3 });
    s = adjustDifficulty(s, 'object_hunt', 85);
    s = adjustDifficulty(s, 'object_hunt', 90);
    expect(s.currentLevel).toBe(3);
    s = adjustDifficulty(s, 'object_hunt', 82);
    expect(s.currentLevel).toBe(4);
    expect(s.consecutiveHighScores).toBe(0);
  });

  it('decreases level after 2 consecutive sessions below 50% accuracy', () => {
    let s = state({ currentLevel: 3 });
    s = adjustDifficulty(s, 'object_hunt', 40);
    expect(s.currentLevel).toBe(3);
    s = adjustDifficulty(s, 'object_hunt', 30);
    expect(s.currentLevel).toBe(2);
    expect(s.consecutiveLowScores).toBe(0);
  });

  it('never goes below 1 or above the per-game max level', () => {
    let low = state({ currentLevel: 1 });
    low = adjustDifficulty(low, 'word_stream', 20);
    low = adjustDifficulty(low, 'word_stream', 10);
    expect(low.currentLevel).toBe(1);

    let high = state({ currentLevel: 6 });
    high = adjustDifficulty(high, 'word_stream', 90);
    high = adjustDifficulty(high, 'word_stream', 90);
    high = adjustDifficulty(high, 'word_stream', 90);
    expect(high.currentLevel).toBe(6);
  });

  it('makes no change for 50-79% accuracy and resets the consecutive counters', () => {
    let s = state({ currentLevel: 4, consecutiveHighScores: 2, consecutiveLowScores: 1 });
    s = adjustDifficulty(s, 'object_hunt', 65);
    expect(s.currentLevel).toBe(4);
    expect(s.consecutiveHighScores).toBe(0);
    expect(s.consecutiveLowScores).toBe(0);
  });
});

describe('getEducationBonus', () => {
  it('returns 2 for educationYears=4, 1 for 10, 0 for 15', () => {
    expect(getEducationBonus(4)).toBe(2);
    expect(getEducationBonus(10)).toBe(1);
    expect(getEducationBonus(15)).toBe(0);
  });
});

describe('logEvent', () => {
  beforeEach(async () => {
    await db.telemetryEvents.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it('writes to db.telemetryEvents with synced=false', async () => {
    useGameStore.getState().startSession('p1');
    const sessionId = useGameStore.getState().activeSession!.id;

    await logEvent({
      sessionId,
      patientId: 'p1',
      gameType: 'object_hunt',
      difficultyLevel: 2,
      roundNumber: 1,
      isCorrect: true,
      responseTimeMs: 900,
      eventTimestamp: new Date().toISOString(),
      metadata: {},
    });

    const rows = await db.telemetryEvents.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].synced).toBe(false);
    expect(rows[0].patientId).toBe('p1');
  });
});

describe('ObjectGrid', () => {
  const objects = OBJECTS.slice(0, 4);

  it('renders totalTiles tile elements', () => {
    render(
      <ObjectGrid
        objects={objects}
        totalTiles={4}
        onTileSelect={() => {}}
        revealState="reveal"
        revealedTileIndex={-1}
        correctTileIndex={0}
        targetObject={objects[0]}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('does not call onTileSelect during the reveal phase', () => {
    let calls = 0;
    render(
      <ObjectGrid
        objects={objects}
        totalTiles={4}
        onTileSelect={() => {
          calls += 1;
        }}
        revealState="reveal"
        revealedTileIndex={-1}
        correctTileIndex={0}
        targetObject={objects[0]}
      />,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(calls).toBe(0);
  });

  it('calls onTileSelect when a tile is tapped during recall', () => {
    let selected = -1;
    render(
      <ObjectGrid
        objects={objects}
        totalTiles={4}
        onTileSelect={(i) => {
          selected = i;
        }}
        revealState="recall"
        revealedTileIndex={-1}
        correctTileIndex={0}
        targetObject={objects[0]}
      />,
    );
    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(selected).toBe(2);
  });
});

describe('MemoryGrid', () => {
  const buildTiles = (): MemoryTile[] => {
    const objs = OBJECTS.slice(0, 2);
    return [
      { object: objs[0], pairId: 0, matched: false },
      { object: objs[1], pairId: 1, matched: false },
      { object: objs[1], pairId: 1, matched: false },
      { object: objs[0], pairId: 0, matched: false },
    ];
  };

  it('renders one button per tile', () => {
    render(
      <MemoryGrid tiles={buildTiles()} faceUpIndices={[]} onTileSelect={() => {}} inputLocked={false} />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('calls onTileSelect with the tapped index', () => {
    let selected = -1;
    render(
      <MemoryGrid
        tiles={buildTiles()}
        faceUpIndices={[]}
        onTileSelect={(i) => {
          selected = i;
        }}
        inputLocked={false}
      />,
    );
    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(selected).toBe(2);
  });

  it('disables a matched tile so it cannot be re-selected', () => {
    let calls = 0;
    const tiles = buildTiles();
    tiles[0].matched = true;
    render(
      <MemoryGrid
        tiles={tiles}
        faceUpIndices={[]}
        onTileSelect={() => {
          calls += 1;
        }}
        inputLocked={false}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
    fireEvent.click(buttons[0]);
    expect(calls).toBe(0);
  });

  it('disables all tiles while input is locked (mismatch shown)', () => {
    render(
      <MemoryGrid tiles={buildTiles()} faceUpIndices={[0, 1]} onTileSelect={() => {}} inputLocked />,
    );
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });
});

describe('Word Stream RECALL scoring', () => {
  it('calculates hits, misses and false_alarms correctly for a known selection', async () => {
    const { scoreRecall } = await import('@/lib/engine/scoring');
    const original = ['gamosa', 'rhino', 'dhol'];
    const selected = new Set(['gamosa', 'tamul']);

    const result = scoreRecall(original, selected);

    expect(result.hits).toBe(1);
    expect(result.misses).toBe(2);
    expect(result.falseAlarms).toBe(1);
  });
});
