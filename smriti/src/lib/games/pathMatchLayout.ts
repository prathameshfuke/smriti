import type { PathPoint } from '@/components/games/PathCanvas';

/** Deterministic PRNG (mulberry32) so a given level always shuffles the same way. */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The Trail Making Test this game is based on (docs/04_GAME_DESIGN.md §2,
 * "Baat Milao") specifically calls for increasing *layout scatter* per
 * level, starting from level 2 — level 1 is spec'd as "Linear arrangement"
 * (the on-ramp round). From level 2 up, point 1..N are shuffled onto a
 * fixed set of grid cells (not left in row-major order), and jitter grows
 * with level to approximate "Slight/Moderate/High scatter." Seeded by level
 * alone (not per-round) so the board stays learnable at a given level, same
 * as before — only which cell holds which number changes across levels, not
 * on every replay.
 */
export function generatePointLayout(numPoints: number, level: number): PathPoint[] {
  const cols = Math.ceil(Math.sqrt(numPoints));
  const rows = Math.ceil(numPoints / cols);
  const cellWidth = 400 / (cols + 1);
  const cellHeight = 600 / (rows + 1);

  const rand = seededRandom(level * 104729 + numPoints);
  const cells = Array.from({ length: rows * cols }, (_, i) => i);
  if (level > 1) {
    for (let i = cells.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
  }

  // Jitter radius grows with level (max 8px, stays well inside the 60px
  // minimum spacing between cells) to read as increasingly scattered.
  // Level 1 stays perfectly linear, per the "Linear arrangement" spec.
  const jitterRange = level === 1 ? 0 : Math.min(8, 2 + level);

  return Array.from({ length: numPoints }, (_, i) => {
    const cell = cells[i];
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    const jitterX = rand() * jitterRange * 2 - jitterRange;
    const jitterY = rand() * jitterRange * 2 - jitterRange;
    return {
      x: (col + 1) * cellWidth + jitterX,
      y: (row + 1) * cellHeight + jitterY,
      label: i + 1,
    };
  });
}
