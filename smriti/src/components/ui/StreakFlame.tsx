export interface StreakFlameProps {
  /** Lit when the patient has an active streak, a grey outline otherwise. */
  active: boolean;
  size?: number;
  className?: string;
}

/**
 * Streak flame: a drawn, rounded two-layer flame in the palette's amber and
 * gold, with a soft flicker while the streak is alive. The flicker is a small
 * scale on each layer from its base (see `smriti-flame-*` in globals.css), so
 * the flame breathes in place instead of bouncing, and it stops entirely
 * under prefers-reduced-motion. Decorative: callers always print the count
 * in words next to it.
 */
export default function StreakFlame({ active, size = 28, className = '' }: StreakFlameProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.2)}
      viewBox="0 0 32 38"
      aria-hidden="true"
      className={`shrink-0 overflow-visible ${className}`}
    >
      <path
        className={active ? 'smriti-flame-outer' : undefined}
        d="M16 1.5c3 6 12 11.5 12 22.5 0 7.9-5.4 13-12 13S4 31.9 4 24c0-5.6 3.2-9.4 5.6-13.2 1 3.6 2.9 5 4.4 5.2-.9-4.9.1-10 2-14.5z"
        fill={active ? '#D97706' : 'none'}
        stroke={active ? '#B3452D' : '#4B4541'}
        strokeOpacity={active ? 1 : 0.45}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {active ? (
        <path
          className="smriti-flame-inner"
          d="M16 17c2.2 3.2 6 5.8 6 11 0 4-2.7 6.5-6 6.5S10 32 10 28c0-2.9 1.6-4.9 3-6.6.7 1.7 1.8 2.5 2.8 2.6-.4-2.4 0-4.8.2-7z"
          fill="#C9A227"
        />
      ) : null}
    </svg>
  );
}
