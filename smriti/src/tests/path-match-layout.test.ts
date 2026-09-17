import { describe, it, expect } from 'vitest';
import { generatePointLayout } from '@/lib/games/pathMatchLayout';

/**
 * The Trail Making Test this game is based on requires points scattered
 * unpredictably — that's the whole point of the visual search task. A prior
 * regression laid points out in simple row-major reading order (point 1 top
 * left, point 2 next to it, and so on), which reads as "the numbers are just
 * counting up left to right," not a search task.
 */
describe('Path Match point layout', () => {
  it('does not place points in row-major reading order', () => {
    // Row-major would put point N at column (N % cols), row floor(N / cols)
    // — i.e. x strictly non-decreasing until a row wraps, then resetting to
    // the same starting x every time. A genuinely shuffled layout breaks
    // that pattern somewhere in the sequence.
    const points = generatePointLayout(9, 5);
    const xs = points.map((p) => p.x);

    let rowMajorMatches = true;
    for (let i = 1; i < xs.length; i += 1) {
      const wrapped = i % 3 === 0;
      if (wrapped ? xs[i] >= xs[i - 1] : xs[i] <= xs[i - 1]) {
        rowMajorMatches = false;
        break;
      }
    }
    expect(rowMajorMatches).toBe(false);
  });

  it('places level 1 points in linear row-major order, per the design doc\'s "Linear arrangement" spec (#19 follow-up)', () => {
    // 4 points at level 1 -> a 2x2 grid, filled row-major: x increases across
    // a row, then wraps back down at the start of the next row.
    const points = generatePointLayout(4, 1);
    const xs = points.map((p) => p.x);
    const cols = Math.ceil(Math.sqrt(points.length));
    for (let i = 1; i < xs.length; i += 1) {
      const wrapped = i % cols === 0;
      if (wrapped) {
        expect(xs[i]).toBeLessThan(xs[i - 1]);
      } else {
        expect(xs[i]).toBeGreaterThan(xs[i - 1]);
      }
    }
  });

  it('is deterministic for a given level, so a returning patient sees the same board', () => {
    const first = generatePointLayout(8, 4);
    const second = generatePointLayout(8, 4);
    expect(second).toEqual(first);
  });

  it('produces a different arrangement at a different level with the same point count', () => {
    const levelFour = generatePointLayout(8, 4);
    const levelFive = generatePointLayout(8, 5);
    expect(levelFive).not.toEqual(levelFour);
  });

  it('keeps every point at least 60px apart (jitter never overlaps adjacent cells)', () => {
    const points = generatePointLayout(12, 8);
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(60);
      }
    }
  });
});

describe('Path Match layout variants (issue #4)', () => {
  it('gives a different board for a different variant at the same level', () => {
    expect(generatePointLayout(8, 4, 1)).not.toEqual(generatePointLayout(8, 4, 2));
  });

  it('gives a different level 1 board across variants while staying linear', () => {
    const boards = [0, 1, 2, 3].map((v) => JSON.stringify(generatePointLayout(4, 1, v)));
    expect(new Set(boards).size).toBe(4);
    // Linear: consecutive points in a row sit side by side (same y).
    const mirrored = generatePointLayout(4, 1, 1);
    expect(mirrored[0].y).toBe(mirrored[1].y);
    expect(mirrored[0].x).toBeGreaterThan(mirrored[1].x);
  });
});
