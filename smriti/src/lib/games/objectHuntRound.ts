import { OBJECTS, type SmritiObject } from '@/lib/engine/objects';
import { slower } from './pacing';

export interface LevelParams {
  rows: number;
  cols: number;
  objectCount: number;
  revealSeconds: number;
  /**
   * How many of the round's objects come from one shared category (all
   * textiles, all animals…). Look-alike neighbours are what make a memory
   * round harder, so this rises with the level: 0 means every object comes
   * from a different category.
   */
  sameCategory: number;
}

/** Grid size, object count, per-tile reveal time and look-alike count for each of the 10 levels.
 * Reveal time slowed 20% (pacing.SLOWDOWN) per clinical feedback. */
export const LEVELS: Record<number, LevelParams> = {
  1: { rows: 2, cols: 2, objectCount: 2, revealSeconds: slower(3), sameCategory: 0 },
  2: { rows: 2, cols: 2, objectCount: 3, revealSeconds: slower(3), sameCategory: 0 },
  3: { rows: 2, cols: 2, objectCount: 4, revealSeconds: slower(2.5), sameCategory: 0 },
  4: { rows: 2, cols: 3, objectCount: 3, revealSeconds: slower(2.5), sameCategory: 2 },
  5: { rows: 2, cols: 3, objectCount: 4, revealSeconds: slower(2), sameCategory: 2 },
  6: { rows: 2, cols: 3, objectCount: 6, revealSeconds: slower(2), sameCategory: 3 },
  7: { rows: 3, cols: 3, objectCount: 5, revealSeconds: slower(2), sameCategory: 3 },
  8: { rows: 3, cols: 3, objectCount: 6, revealSeconds: slower(1.5), sameCategory: 3 },
  9: { rows: 3, cols: 4, objectCount: 6, revealSeconds: slower(1.5), sameCategory: 4 },
  10: { rows: 3, cols: 4, objectCount: 8, revealSeconds: slower(1), sameCategory: 4 },
};

export type Rng = () => number;

export interface PlacedObject {
  index: number;
  object: SmritiObject;
}

export interface Round {
  tiles: (SmritiObject | null)[];
  /** The order pictures are shown in during the reveal. */
  revealOrder: PlacedObject[];
  /** The order the patient is asked about them — deliberately not the reveal order. */
  recallOrder: PlacedObject[];
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Picks a round's objects: `sameCategory` of them from one shared category
 * (look-alikes), the rest from as many different categories as the pool
 * allows. Objects in `exclude` (the last few rounds' pictures) are left out
 * so consecutive rounds do not repeat.
 */
export function pickRoundObjects(
  count: number,
  sameCategory: number,
  exclude: readonly string[] = [],
  rng: Rng = Math.random,
): SmritiObject[] {
  let pool = OBJECTS.filter((o) => !exclude.includes(o.id));
  // A small pool must never make a round impossible: drop the exclusion.
  if (pool.length < count) pool = [...OBJECTS];

  const byCategory = new Map<string, SmritiObject[]>();
  for (const o of shuffled(pool, rng)) byCategory.set(o.category, [...(byCategory.get(o.category) ?? []), o]);

  const picked: SmritiObject[] = [];
  const want = Math.min(sameCategory, count);
  if (want >= 2) {
    const roomy = [...byCategory.entries()].filter(([, items]) => items.length >= want);
    if (roomy.length > 0) {
      const [category, items] = shuffled(roomy, rng)[0];
      picked.push(...items.slice(0, want));
      byCategory.delete(category);
    }
  }

  // The rest: one object per remaining category first, then any leftovers.
  const categories = shuffled([...byCategory.keys()], rng);
  for (const category of categories) {
    if (picked.length >= count) break;
    picked.push(byCategory.get(category)![0]);
  }
  if (picked.length < count) {
    const taken = new Set(picked.map((o) => o.id));
    const leftovers = shuffled(pool.filter((o) => !taken.has(o.id)), rng);
    picked.push(...leftovers.slice(0, count - picked.length));
  }
  return shuffled(picked, rng);
}

/** Places the objects on random tiles, and draws separate random reveal and recall orders. */
export function buildRound(level: LevelParams, exclude: readonly string[] = [], rng: Rng = Math.random): Round {
  const totalTiles = level.rows * level.cols;
  const objects = pickRoundObjects(level.objectCount, level.sameCategory, exclude, rng);
  const positions = shuffled(Array.from({ length: totalTiles }, (_, i) => i), rng);
  const tiles: (SmritiObject | null)[] = Array(totalTiles).fill(null);
  const placed: PlacedObject[] = objects.map((object, i) => {
    tiles[positions[i]] = object;
    return { index: positions[i], object };
  });

  const revealOrder = shuffled(placed, rng);
  let recallOrder = shuffled(placed, rng);
  // With two or more objects, asking in the order they were shown lets the
  // patient answer by rhythm rather than memory — draw again until it differs.
  for (let tries = 0; placed.length > 1 && tries < 5; tries += 1) {
    if (recallOrder.some((p, i) => p.object.id !== revealOrder[i].object.id)) break;
    recallOrder = shuffled(placed, rng);
  }
  return { tiles, revealOrder, recallOrder };
}

const recentKey = (patientId: string) => `smriti.objectHunt.recent.${patientId}`;
/** Pictures from this many recent rounds are kept out of the next round. */
export const RECENT_ROUNDS = 2;

/** The object ids used in this patient's last few rounds, across sessions. */
export function loadRecentObjectIds(patientId: string | undefined): string[][] {
  if (!patientId) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(recentKey(patientId)) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((r): r is string[] => Array.isArray(r) && r.every((id) => typeof id === 'string')).slice(-RECENT_ROUNDS)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentObjectIds(patientId: string | undefined, recent: string[][]): void {
  if (!patientId) return;
  try {
    window.localStorage.setItem(recentKey(patientId), JSON.stringify(recent.slice(-RECENT_ROUNDS)));
  } catch {
    // Storage blocked: rounds within this visit still avoid repeats via the caller's own list.
  }
}
