'use client';

import type { SmritiObject } from '@/lib/engine/objects';
import { useTapSelect } from '@/hooks/useTapSelect';

export interface MemoryTile {
  object: SmritiObject;
  /** Index into the pair — two tiles share the same pairId. */
  pairId: number;
  matched: boolean;
}

export interface MemoryGridProps {
  tiles: MemoryTile[];
  /** Indices currently face-up (0, 1, or 2 while resolving a mismatch). */
  faceUpIndices: number[];
  onTileSelect: (index: number) => void;
  /** Tiles cannot be tapped while a mismatched pair is being shown. */
  inputLocked: boolean;
}

function columnsFor(totalTiles: number): string {
  if (totalTiles <= 4) return 'grid-cols-2';
  if (totalTiles <= 6) return 'grid-cols-3';
  return 'grid-cols-4';
}

/**
 * Face-down/face-up card grid for Memory Match. Matched pairs stay revealed
 * and disabled; everything else behaves like a single toggle button so
 * keyboard and switch users get the same interaction as touch.
 */
/** Larger than the app-wide touch-target floor: these tiles are the whole
 * point of the game, not an incidental control, and were reported as too
 * small to comfortably see and tap. */
const TILE_MIN_PX = 92;

export default function MemoryGrid({ tiles, faceUpIndices, onTileSelect, inputLocked }: MemoryGridProps) {
  const tapSelect = useTapSelect();

  return (
    <div className={`grid ${columnsFor(tiles.length)} gap-4`}>
      {tiles.map((tile, i) => {
        const isFaceUp = tile.matched || faceUpIndices.includes(i);
        const disabled = tile.matched || inputLocked || faceUpIndices.includes(i);
        const tap = tapSelect(() => onTileSelect(i), !disabled);

        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            aria-label={isFaceUp ? tile.object.name.en : `Card ${i + 1}`}
            {...tap}
            style={{
              ...tap.style,
              minHeight: TILE_MIN_PX,
              minWidth: TILE_MIN_PX,
              backgroundColor: isFaceUp ? `${tile.object.categoryColor}33` : undefined,
            }}
            className={
              'flex items-center justify-center rounded-card border-2 ' +
              'transition-all duration-300 ' +
              (tile.matched
                ? 'border-success/40 bg-success/10'
                : 'border-surface-muted bg-game-tile') +
              (disabled ? ' cursor-default' : ' cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 motion-reduce:hover:translate-y-0')
            }
          >
            {isFaceUp ? (
              <span className="text-5xl" aria-hidden="true">
                {tile.object.emoji}
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
  );
}
