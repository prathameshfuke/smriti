export type TriageStatus = 'red' | 'yellow' | 'green';

export interface TrafficLightProps {
  status: TriageStatus;
  size?: 'sm' | 'md';
}

const COLOR: Record<TriageStatus, string> = {
  red: 'bg-danger text-ink-inverse',
  yellow: 'bg-warning text-ink',
  green: 'bg-success text-ink',
};

/**
 * Colour alone would fail WCAG 1.4.1 and is unreadable to the ~8% of men with
 * colour-vision deficiency, so each state also carries a distinct glyph.
 * The glyph is ink on the lighter green and amber fills, where white would
 * drop to ~3:1.
 */
const GLYPH: Record<TriageStatus, string> = {
  red: '!',
  yellow: '~',
  green: '✓',
};

/** Triage marker for the caregiver's patient list. */
export default function TrafficLight({ status, size = 'md' }: TrafficLightProps) {
  const dim = size === 'sm' ? 'h-5 w-5 text-xs' : 'h-6 w-6 text-sm';
  return (
    <span
      role="img"
      aria-label={`Status: ${status}`}
      className={
        'inline-flex shrink-0 items-center justify-center rounded-full ' +
        `font-bold leading-none ${dim} ${COLOR[status]}`
      }
    >
      <span aria-hidden="true">{GLYPH[status]}</span>
    </span>
  );
}
