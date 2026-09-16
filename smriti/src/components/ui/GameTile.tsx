'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BIG_TARGET_MIN_PX } from './touchTarget';

export interface GameTileProps {
  gameName: string;
  /** Navigation target. Omit and pass onClick to use the tile as a button. */
  href?: string;
  onClick?: () => void;
  /** Pre-cached illustration; carries the meaning for non-readers. */
  illustrationSrc?: string;
  /** 1-3. Shown as filled dots so difficulty is legible without reading. */
  difficultyLevel?: 1 | 2 | 3;
  icon?: ReactNode;
}

const TILE_CLASS =
  'flex w-full items-center gap-4 rounded-tile border border-line200 bg-surface-card px-4 py-3 ' +
  'text-left text-patient-body font-bold text-ink ' +
  'transition-[transform,border-color,background-color] duration-150 active:scale-[0.98] ' +
  'motion-reduce:active:scale-100 hover:border-ink-muted hover:bg-surface-muted/40 ' +
  'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark';

/**
 * Home-screen entry point for one game, laid out as a full-width row: the
 * picture on the left, the name beside it, difficulty on the far right.
 * A single column reads top to bottom with no zig-zag between grid cells,
 * the name has room at 22px without wrapping, and every row is the same
 * shape so a patient learns it once. Reaching a game is still one tap from
 * the home screen.
 */
export default function GameTile({
  gameName,
  href,
  onClick,
  illustrationSrc,
  difficultyLevel,
  icon,
}: GameTileProps) {
  const body = (
    <>
      {illustrationSrc ? (
        // Plain img: assets are pre-cached by the service worker, and the
        // optimizer is unavailable offline.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={illustrationSrc}
          alt=""
          role="presentation"
          data-scalable-icon
          className="h-14 w-14 shrink-0 rounded-control object-contain"
        />
      ) : icon ? (
        <span
          aria-hidden="true"
          data-scalable-icon
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-surface-muted text-primary"
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 break-words leading-snug">{gameName}</span>
      {difficultyLevel ? (
        <span className="flex shrink-0 gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((level) => (
            <span
              key={level}
              data-difficulty-dot={level <= difficultyLevel ? 'on' : 'off'}
              className={
                'h-2.5 w-2.5 rounded-full ' +
                (level <= difficultyLevel ? 'bg-primary' : 'border border-ink-muted/50 bg-transparent')
              }
            />
          ))}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-label={gameName}
        style={{ minHeight: BIG_TARGET_MIN_PX }}
        className={TILE_CLASS}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={gameName}
      style={{ minHeight: BIG_TARGET_MIN_PX }}
      className={TILE_CLASS}
    >
      {body}
    </button>
  );
}
