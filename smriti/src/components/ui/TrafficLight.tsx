export type TriageStatus = 'red' | 'yellow' | 'green';

export interface TrafficLightProps {
  status: TriageStatus;
  size?: 'sm' | 'md';
}

const COLOR: Record<TriageStatus, string> = {
  red: 'bg-danger',
  yellow: 'bg-warning',
  green: 'bg-success',
};

/**
 * Colour alone would fail WCAG 1.4.1 and is unreadable to the ~8% of men with
 * colour-vision deficiency, so each state also carries a distinct glyph.
 */
const GLYPH: Record<TriageStatus, string> = {
  red: '!',
  yellow: '~',
  green: '✓',
};

/** Triage dot for the caregiver's patient list. */
export default function TrafficLight({ status, size = 'md' }: TrafficLightProps) {
  const dim = size === 'sm' ? 'h-4 w-4 text-[10px]' : 'h-5 w-5 text-xs';
  return (
    <span
      role="img"
      aria-label={`Status: ${status}`}
      className={
        'inline-flex shrink-0 items-center justify-center rounded-full ' +
        `font-bold text-ink-inverse ${dim} ${COLOR[status]}`
      }
    >
      <span aria-hidden="true">{GLYPH[status]}</span>
    </span>
  );
}
