'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Minimal shadcn-compatible Dialog family (no Radix dependency) — vendored
 * so pasted reference-game components compile and behave unchanged.
 */

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const setOpen = React.useCallback((next: boolean) => onOpenChange?.(next), [onOpenChange]);
  return <DialogContext.Provider value={{ open: !!open, setOpen }}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
}) {
  const ctx = React.useContext(DialogContext);
  const onClick: React.MouseEventHandler = (e) => {
    children.props.onClick?.(e);
    ctx?.setOpen(true);
  };
  if (asChild) return React.cloneElement(children, { onClick });
  return (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const ctx = React.useContext(DialogContext);
  const open = !!ctx?.open;
  const setOpen = ctx?.setOpen;

  // Escape closes, like any modal. Without it (and without the close button
  // below) the only way out was tapping the dimmed backdrop, which patients
  // did not discover — the N-Back tutorial looked like a trap.
  React.useEffect(() => {
    if (!open || !setOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!ctx?.open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={() => ctx.setOpen(false)}
    >
      <div
        className={cn(
          // max-h + scroll: at Large text a long dialog (the N-Back tutorial)
          // outgrew the screen and its Next/Close buttons were cut off.
          'max-h-full w-full max-w-md overflow-y-auto overscroll-contain rounded-card border border-line200 bg-white p-6 shadow-xl',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="-mr-2 -mt-2 flex justify-end">
          <button
            type="button"
            aria-label="Close"
            onClick={() => ctx.setOpen(false)}
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-ink-muted hover:bg-surface-muted focus-visible:outline focus-visible:outline-4 focus-visible:outline-primary"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('font-serif-display text-[1.375rem] font-medium leading-tight text-ink', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-base text-ink-muted', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex justify-end gap-2', className)} {...props} />;
}
