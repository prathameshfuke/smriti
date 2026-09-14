import type { ReactNode } from 'react';
import type { StatusTone } from '@/components/ui/StatusBadge';

const SURFACE: Record<StatusTone, string> = {
  success: 'border-success/50 bg-success/5',
  warning: 'border-warning/50 bg-warning/5',
  danger: 'border-danger/40 bg-danger/5',
};

const MARKER: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/** A coloured marker plus ink text, matching StatusBadge's colour-plus-word
 * rule: never a tinted background is the only signal, and text never sits
 * directly on the status colour. Shared by every tab that shows a save/load
 * result (Cognitive's digest, Companion's quiz, Family's post/alert result). */
export default function Notice({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <p className={`flex items-start gap-3 rounded-tile border px-4 py-3 text-caregiver-body text-ink ${SURFACE[tone]}`}>
      <span aria-hidden="true" className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${MARKER[tone]}`} />
      <span>{children}</span>
    </p>
  );
}
