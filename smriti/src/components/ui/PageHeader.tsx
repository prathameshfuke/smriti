import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  /** One sentence of orientation: what this page is for. */
  description?: ReactNode;
  /** A single primary action. Sits beside the title on wide screens, below it on phones. */
  action?: ReactNode;
  /** Replaces nothing; renders above the title (e.g. a back link). */
  before?: ReactNode;
}

/**
 * The top of every caregiver page: title, one line of context, at most one
 * action. The title is the strongest type on the screen, so a caregiver who
 * lands here from a notification knows where they are before anything else.
 */
export default function PageHeader({ title, description, action, before }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between md:gap-8">
      <div className="min-w-0">
        {before}
        <h1 className="font-serif-display text-[1.875rem] font-medium leading-[1.1] tracking-[-0.01em] text-ink md:text-[2.5rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[60ch] text-caregiver-body text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="w-full shrink-0 md:w-auto md:min-w-56">{action}</div> : null}
    </header>
  );
}
