import { beforeEach, describe, expect, it } from 'vitest';
import { OBJECTS } from '@/lib/engine/objects';
import {
  LEVELS,
  buildRound,
  loadRecentObjectIds,
  pickRoundObjects,
  saveRecentObjectIds,
} from '@/lib/games/objectHuntRound';

/** Small seeded generator so a failure can be reproduced. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const levelNumbers = Object.keys(LEVELS).map(Number).sort((a, b) => a - b);

describe('Object Hunt level ladder', () => {
  it('has 10 levels that never get easier', () => {
    expect(levelNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Load = objects to remember x places they could be.
    const key = (n: number) => {
      const l = LEVELS[n];
      return [l.objectCount * l.rows * l.cols, l.sameCategory, -l.revealSeconds];
    };
    for (let n = 2; n <= 10; n += 1) {
      const [prevLoad, prevSame, prevReveal] = key(n - 1);
      const [load, same, reveal] = key(n);
      expect(load).toBeGreaterThanOrEqual(prevLoad);
      expect(same).toBeGreaterThanOrEqual(prevSame);
      expect(reveal).toBeGreaterThanOrEqual(prevReveal);
      // ...and every step changes something the patient can see or feel.
      expect([load, same, reveal]).not.toEqual([prevLoad, prevSame, prevReveal]);
    }
  });

  it('never asks for more objects than the grid has tiles', () => {
    for (const n of levelNumbers) expect(LEVELS[n].objectCount).toBeLessThanOrEqual(LEVELS[n].rows * LEVELS[n].cols);
  });

  it('draws from a pool far larger than any round', () => {
    expect(OBJECTS.length).toBeGreaterThanOrEqual(3 * Math.max(...levelNumbers.map((n) => LEVELS[n].objectCount)));
  });
});

describe('buildRound', () => {
  it.each(levelNumbers)('level %i: right size, distinct objects, look-alikes as required', (n) => {
    const level = LEVELS[n];
    for (let seed = 1; seed <= 60; seed += 1) {
      const round = buildRound(level, [], seeded(seed));
      const ids = round.revealOrder.map((p) => p.object.id);
      expect(round.tiles).toHaveLength(level.rows * level.cols);
      expect(ids).toHaveLength(level.objectCount);
      expect(new Set(ids).size).toBe(level.objectCount);
      // Every object sits on the tile it says it sits on.
      for (const p of round.revealOrder) expect(round.tiles[p.index]?.id).toBe(p.object.id);
      expect(round.tiles.filter(Boolean)).toHaveLength(level.objectCount);
      // Same objects are shown and asked about.
      expect([...round.recallOrder.map((p) => p.object.id)].sort()).toEqual([...ids].sort());

      const perCategory = new Map<string, number>();
      for (const p of round.revealOrder) perCategory.set(p.object.category, (perCategory.get(p.object.category) ?? 0) + 1);
      const largestGroup = Math.max(...perCategory.values());
      if (level.sameCategory >= 2) expect(largestGroup).toBeGreaterThanOrEqual(level.sameCategory);
      else expect(largestGroup).toBe(1);
    }
  });

  it('asks about the pictures in a different order from the reveal', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const round = buildRound(LEVELS[3], [], seeded(seed));
      const shown = round.revealOrder.map((p) => p.object.id).join();
      const asked = round.recallOrder.map((p) => p.object.id).join();
      expect(asked).not.toBe(shown);
    }
  });

  it('still asks in a different order when every random draw would repeat the reveal order', () => {
    // A constant generator makes every shuffle identical, so only the tie-break can differ.
    for (const level of [LEVELS[1], LEVELS[5], LEVELS[10]]) {
      const round = buildRound(level, [], () => 0.5);
      const shown = round.revealOrder.map((p) => p.object.id).join();
      const asked = round.recallOrder.map((p) => p.object.id).join();
      expect(asked).not.toBe(shown);
      expect([...round.recallOrder.map((p) => p.object.id)].sort()).toEqual([...round.revealOrder.map((p) => p.object.id)].sort());
    }
  });

  it('does not always reveal in tile (reading) order', () => {
    let readingOrder = 0;
    for (let seed = 1; seed <= 100; seed += 1) {
      const idx = buildRound(LEVELS[8], [], seeded(seed)).revealOrder.map((p) => p.index);
      if (idx.every((v, i) => i === 0 || idx[i - 1] < v)) readingOrder += 1;
    }
    expect(readingOrder).toBeLessThan(10);
  });

  it('keeps recent pictures out of the next round', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const first = buildRound(LEVELS[10], [], seeded(seed)).revealOrder.map((p) => p.object.id);
      const second = buildRound(LEVELS[10], first, seeded(seed + 1000)).revealOrder.map((p) => p.object.id);
      expect(second.filter((id) => first.includes(id))).toEqual([]);
    }
  });

  it('still builds a round when the exclusion list would empty the pool', () => {
    const everything = OBJECTS.map((o) => o.id);
    expect(pickRoundObjects(8, 4, everything, seeded(1))).toHaveLength(8);
  });

  it('gives different content on different draws (real randomness, not a fixed pool)', () => {
    const seen = new Set<string>();
    let identicalNeighbours = 0;
    let previous = '';
    for (let i = 0; i < 40; i += 1) {
      const ids = buildRound(LEVELS[5], []).revealOrder.map((p) => p.object.id);
      ids.forEach((id) => seen.add(id));
      const layout = buildRound(LEVELS[5], []).tiles.map((t) => t?.id ?? '-').join();
      if (layout === previous) identicalNeighbours += 1;
      previous = layout;
    }
    // 40 rounds x 4 objects should reach a good share of the 66-item pool.
    expect(seen.size).toBeGreaterThan(40);
    expect(identicalNeighbours).toBe(0);
  });
});

describe('recent-object memory', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips the last two rounds per patient', () => {
    saveRecentObjectIds('p1', [['a'], ['b'], ['c']]);
    expect(loadRecentObjectIds('p1')).toEqual([['b'], ['c']]);
    expect(loadRecentObjectIds('p2')).toEqual([]);
  });

  it('ignores garbled storage', () => {
    window.localStorage.setItem('smriti.objectHunt.recent.p1', '{not json');
    expect(loadRecentObjectIds('p1')).toEqual([]);
    window.localStorage.setItem('smriti.objectHunt.recent.p1', JSON.stringify([[1, 2], 'x', ['ok']]));
    expect(loadRecentObjectIds('p1')).toEqual([['ok']]);
  });
});
