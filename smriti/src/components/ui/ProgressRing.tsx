export interface ProgressRingProps {
  /** 0-100; values outside the range are clamped. */
  value: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const DIMENSIONS = {
  sm: { box: 60, stroke: 6, text: 'text-patient-sm' },
  md: { box: 80, stroke: 8, text: 'text-patient-body' },
  lg: { box: 120, stroke: 10, text: 'text-patient-heading' },
} as const;

/**
 * Session progress. The arc sweeps up from empty on mount: a static ring
 * reads as decoration, a filling one reads as "this is your score today".
 */
export default function ProgressRing({ value, size = 'md', label }: ProgressRingProps) {
  const pct = Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
  const { box, stroke, text } = DIMENSIONS[size];
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const offset = circumference * (1 - pct / 100);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
        role="img"
        aria-label={label ?? `${pct} percent complete`}
      >
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-muted"
        />
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
          style={
            {
              '--ring-circumference': circumference,
              '--ring-offset': offset,
            } as React.CSSProperties
          }
          className="stroke-primary animate-ring-fill motion-reduce:animate-none"
        />
      </svg>
      <span className={`absolute font-semibold text-ink ${text}`}>{pct}%</span>
    </div>
  );
}
