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
 * with level to approximate "Slight/Moderate/High scatter."
 *
 * `variant` picks a different board at the same level. Seeding by level
 * alone meant a patient who stayed on one level (common on level 1) saw the
 * identical board every round and every session (issue #4). Variant 0 keeps
 * the original board; callers pass a per-session + per-round value.
 * Level 1 stays a linear arrangement for every variant — only mirrored, so
 * the path starts from a different corner.
 */
export function generatePointLayout(numPoints: number, level: number, variant = 0): PathPoint[] {
  const cols = Math.ceil(Math.sqrt(numPoints));
  const rows = Math.ceil(numPoints / cols);
  const cellWidth = 400 / (cols + 1);
  const cellHeight = 600 / (rows + 1);

  const rand = seededRandom(level * 104729 + numPoints + variant * 7919);
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
  const mirrorX = level === 1 && (variant & 1) === 1;
  const mirrorY = level === 1 && (variant & 2) === 2;

  const jitterRange = level === 1 ? 0 : Math.min(8, 2 + level);

  return Array.from({ length: numPoints }, (_, i) => {
    const cell = cells[i];
    const rawCol = cell % cols;
    const rawRow = Math.floor(cell / cols);
    const col = mirrorX ? cols - 1 - rawCol : rawCol;
    const row = mirrorY ? rows - 1 - rawRow : rawRow;
    const jitterX = rand() * jitterRange * 2 - jitterRange;
    const jitterY = rand() * jitterRange * 2 - jitterRange;
    return {
      x: (col + 1) * cellWidth + jitterX,
      y: (row + 1) * cellHeight + jitterY,
      label: i + 1,
    };
  });
}
