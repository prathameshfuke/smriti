import Link from 'next/link';
import type { ReactNode } from 'react';
import { TOUCH_TARGET_MIN_PX } from './touchTarget';

export interface GameTileProps {
  gameName: string;
  href: string;
  /** Shown under the name; keep to a few words. */
  subtitle?: string;
  icon?: ReactNode;
}

/**
 * Home-screen entry point for one game. Reaching a game must take at most
 * three taps, so tiles are the first thing on the patient home screen.
 */
export default function GameTile({ gameName, href, subtitle, icon }: GameTileProps) {
  return (
    <Link
      href={href}
      aria-label={gameName}
      style={{ minHeight: TOUCH_TARGET_MIN_PX }}
      className={
        'flex flex-col items-center justify-center gap-2 rounded-tile bg-game-tile p-6 ' +
        'text-center text-patient-body font-semibold text-ink transition-colors ' +
        'hover:bg-game-active active:bg-game-active ' +
        'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 ' +
        'focus-visible:outline-primary'
      }
    >
      {icon ? (
        <span aria-hidden="true" className="text-primary">
          {icon}
        </span>
      ) : null}
      <span>{gameName}</span>
      {subtitle ? <span className="text-patient-sm text-ink-muted">{subtitle}</span> : null}
    </Link>
  );
}
