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
  'flex flex-col items-center justify-center gap-2 rounded-tile border border-gray-300 ' +
  'bg-white p-6 shadow-sm text-center text-patient-body font-semibold text-ink ' +
  'transition-all duration-100 active:scale-[0.97] motion-reduce:active:scale-100 ' +
  'hover:shadow-md hover:border-teal/40 focus-visible:outline focus-visible:outline-4 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Home-screen entry point for one game. Reaching a game must take at most
 * three taps, so tiles are the first thing on the patient home screen.
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
        <img src={illustrationSrc} alt="" role="presentation" className="h-24 w-24 object-contain" />
      ) : icon ? (
        <span aria-hidden="true" className="text-primary">
          {icon}
        </span>
      ) : null}
      <span>{gameName}</span>
      {difficultyLevel ? (
        <span className="flex gap-1" aria-hidden="true">
          {[1, 2, 3].map((level) => (
            <span
              key={level}
              data-difficulty-dot={level <= difficultyLevel ? 'on' : 'off'}
              className={
                'h-3 w-3 rounded-full ' +
                (level <= difficultyLevel ? 'bg-primary' : 'bg-surface-muted')
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
