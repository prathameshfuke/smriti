import * as React from 'react';
import { cn } from '@/lib/utils';

/** Minimal shadcn-compatible Input — vendored so pasted reference-game components compile unchanged. */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-12 w-full rounded-control border-2 border-ink-muted/60 bg-white px-3 text-base text-ink focus:border-primary-dark focus:outline-none',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
