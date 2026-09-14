import type { ReactNode } from 'react';

export interface PanelProps {
  title?: string;
  description?: ReactNode;
  /** A quiet text action at the right of the title row, e.g. "Refresh". */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Rows run edge to edge (lists with dividers) instead of padded content. */
  flush?: boolean;
  as?: 'section' | 'div';
}

/**
 * The one white working surface: warm-grey border, no resting shadow, one
 * radius. A panel groups content that belongs together; it is not a frame
 * put around every paragraph.
 */
export default function Panel({
  title,
  description,
  action,
  children,
  className = '',
  flush = false,
  as: Tag = 'section',
}: PanelProps) {
  const hasHead = Boolean(title || action);
  return (
    <Tag className={`rounded-card border border-line200 bg-surface-card ${className}`}>
      {hasHead ? (
        <div className={`flex items-start justify-between gap-4 ${flush ? 'px-5 pt-5 pb-3' : 'px-5 pt-5'}`}>
          <div className="min-w-0">
            {title ? (
              <h2 className="font-serif-display text-[1.375rem] font-medium leading-tight text-ink">{title}</h2>
            ) : null}
            {description ? <p className="mt-1 text-patient-sm text-ink-muted">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={flush ? '' : hasHead ? 'px-5 pt-4 pb-5' : 'p-5'}>{children}</div>
    </Tag>
  );
}

/** Low-emphasis action: underlined terracotta text, 48px tall hit area. */
export const textActionClass =
  'inline-flex min-h-touch-min items-center text-caregiver-body font-bold text-primary-dark ' +
  'underline decoration-primary/40 underline-offset-4 hover:decoration-primary-dark ' +
  'disabled:no-underline disabled:opacity-50';

/** Text inputs and textareas. 56px tall, visible 3:1 boundary, terracotta focus. */
export const fieldClass =
  'min-h-14 w-full rounded-control border-2 border-ink-muted/60 bg-surface-card px-4 py-3 ' +
  'text-caregiver-body text-ink placeholder:text-ink-muted/80 transition-colors ' +
  'focus:border-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/25';

/** Visible label above a field. Placeholder text is never the only label. */
export const labelClass = 'mb-2 block text-caregiver-body font-bold text-ink';

/** Compact buttons for dense caregiver panels, where a full-width BigButton
 * would dominate the row. Still 48px tall with a 3:1 boundary. */
export const buttonClass = {
  primary:
    'inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-5 text-caregiver-body font-bold ' +
    'text-ink-inverse transition-colors hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-50',
  secondary:
    'inline-flex min-h-12 items-center justify-center rounded-control border-2 border-ink-muted bg-surface-card px-5 ' +
    'text-caregiver-body font-bold text-ink transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50',
} as const;
