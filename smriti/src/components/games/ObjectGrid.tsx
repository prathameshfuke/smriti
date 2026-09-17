'use client';

import type { SmritiObject } from '@/lib/engine/objects';
import { TOUCH_TARGET_MIN_PX } from '@/components/ui/touchTarget';
import { useTapSelect } from '@/hooks/useTapSelect';

export type RevealState = 'reveal' | 'recall';

export interface ObjectGridProps {
  /** One entry per tile (length === totalTiles); null means an empty decoy tile. */
  objects: (SmritiObject | null)[];
  totalTiles: number;
  onTileSelect: (index: number) => void;
  revealState: RevealState;
  /** Index currently open during REVEAL, or -1 when none is open. */
  revealedTileIndex: number;
  correctTileIndex: number;
  targetObject: SmritiObject;
  /** Index just tapped right/wrong, briefly flashed, then cleared by the caller. */
  flashIndex?: number;
  flashCorrect?: boolean;
  /** Recall-phase question text, shown instead of the target picture. */
  targetLabel?: string;
}

function columnsFor(totalTiles: number): string {
  if (totalTiles <= 6) return 'grid-cols-2';
  if (totalTiles <= 9) return 'grid-cols-3';
  return 'grid-cols-4';
}

export default function ObjectGrid({
  objects,
  totalTiles,
  onTileSelect,
  revealState,
  revealedTileIndex,
  // Not destructured to a local binding: kept in ObjectGridProps only so
  // callers still type-check against the real target index. See the
  // isOpen comment below for why this component must never read it itself.
  targetObject,
  flashIndex,
  flashCorrect,
  targetLabel,
}: ObjectGridProps) {
  const tapEnabled = revealState === 'recall';
  const tapSelect = useTapSelect();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* No picture above the grid in either phase (issue #4): during
          reveal the tiles themselves show it, and during recall showing it
          would let the patient match by sight instead of from memory. */}
      {tapEnabled ? (
        <p className="text-center font-serif-display text-patient-heading text-ink" data-testid="object-grid-question">
          {targetLabel ?? targetObject.name.en}
        </p>
      ) : null}

      <div className={`grid ${columnsFor(totalTiles)} gap-4`}>
        {Array.from({ length: totalTiles }).map((_, i) => {
          const obj = objects[i] ?? null;
          const isFlashed = flashIndex === i;
          // During recall, a tile must never reveal its object ahead of a
          // correct tap — it previously kept the answer tile open the whole
          // round by keying off correctTileIndex unconditionally.
          const isOpen =
            (revealState === 'reveal' ? i === revealedTileIndex : isFlashed && flashCorrect === true) && obj !== null;

          const flashClass = isFlashed
            ? flashCorrect
              ? 'ring-2 ring-success bg-success/20'
              : 'ring-2 ring-warning bg-warning/20'
            : '';

          const tap = tapSelect(() => onTileSelect(i), tapEnabled);

          return (
            <button
              key={i}
              type="button"
              disabled={!tapEnabled}
              aria-label={isOpen && obj ? obj.name.en : `Tile ${i + 1}`}
              {...tap}
              style={{
                ...tap.style,
                // Larger than the app-wide touch-target floor: these tiles are
                // the whole point of the game, reported as too small to
                // comfortably see and tap.
                minHeight: TOUCH_TARGET_MIN_PX + 28,
                minWidth: TOUCH_TARGET_MIN_PX + 28,
                backgroundColor: isOpen && obj ? `${obj.categoryColor}33` : undefined,
              }}
              className={
                'flex items-center justify-center rounded-card border-2 border-surface-muted ' +
                `bg-game-tile transition-all duration-300 ${
                  tapEnabled ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 motion-reduce:hover:translate-y-0' : 'cursor-default'
                } ` +
                flashClass
              }
            >
              {isOpen && obj ? (
                <span className="text-5xl" aria-hidden="true">
                  {obj.emoji}
                </span>
              ) : (
                <span className="text-3xl text-ink-muted" aria-hidden="true">
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
