export type TriageStatus = 'red' | 'yellow' | 'green';

export interface TrafficLightProps {
  status: TriageStatus;
  size?: 'sm' | 'md';
}

/**
 * Triage dot for the caregiver's patient list.
 *
 * Colour alone would fail WCAG 1.4.1 and is unreadable to the ~8% of men with
 * colour-vision deficiency, so the meaning lives in the accessible name.
 */
const MEANING: Record<TriageStatus, string> = {
  red: 'Needs attention',
  yellow: 'Check soon',
  green: 'Stable',
};

const COLOR: Record<TriageStatus, string> = {
  red: 'bg-danger',
  yellow: 'bg-warning',
  green: 'bg-success',
};

export default function TrafficLight({ status, size = 'md' }: TrafficLightProps) {
  const dim = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <span
      role="img"
      aria-label={MEANING[status]}
      className={`inline-block shrink-0 rounded-full ${dim} ${COLOR[status]}`}
    />
  );
}
