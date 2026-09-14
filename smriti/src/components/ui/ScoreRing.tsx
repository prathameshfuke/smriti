import type { ReactNode } from 'react';

export interface ScoreRingProps {
  /** 0-100. Null draws an empty track with a dash. */
  value: number | null;
  size?: 'sm' | 'lg';
  /** Replaces the default centre text. */
  children?: ReactNode;
  label: string;
}

const DIMENSIONS = {
  sm: { box: 52, stroke: 5, text: 'text-base font-bold' },
  lg: { box: 152, stroke: 12, text: 'font-serif-display text-[2.75rem] font-medium' },
} as const;

/**
 * Circular 0-100 gauge for the cognitive score. The arc fills from empty
 * once on mount (the same CSS keyframes as ProgressRing, no JS animation
 * loop), and the number in the middle is always the real value, so the ring
 * is reinforcement, never the only way to read the score.
 */
export default function ScoreRing({ value, size = 'sm', children, label }: ScoreRingProps) {
  const { box, stroke, text } = DIMENSIONS[size];
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - pct / 100);

  return (
    <div role="img" aria-label={label} className="relative inline-flex shrink-0 items-center justify-center">
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
        <circle cx={box / 2} cy={box / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-surface-muted" />
        {value !== null ? (
          <circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${box / 2} ${box / 2})`}
            style={{ '--ring-circumference': circumference, '--ring-offset': offset } as React.CSSProperties}
            className="stroke-primary animate-ring-fill motion-reduce:animate-none"
          />
        ) : null}
      </svg>
      <span aria-hidden="true" className={`absolute leading-none text-ink ${text}`}>
        {children ?? (value === null ? '–' : Math.round(value))}
      </span>
    </div>
  );
}
