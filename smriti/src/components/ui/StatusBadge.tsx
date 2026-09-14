export type StatusTone = 'success' | 'warning' | 'danger';

interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
}

const MARKER_CLASSES: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/**
 * Inline status: a coloured marker plus a label in ink. The label is never
 * drawn in the status colour itself: success green (#39A85A) and warning
 * amber (#D97706) are only ~3:1 on white, too faint for text an older reader
 * has to rely on. The marker carries the colour, the words carry the meaning,
 * so the state still reads without colour vision (WCAG 1.4.1).
 */
export default function StatusBadge({ tone, label }: StatusBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2 text-patient-sm font-bold text-ink">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${MARKER_CLASSES[tone]}`} aria-hidden="true" />
      {label}
    </span>
  );
}
