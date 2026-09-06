import * as React from 'react';
import { cn } from '@/lib/utils';

/** Minimal shadcn-compatible Input — vendored so pasted reference-game components compile unchanged. */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-control border border-line200 bg-white px-3 text-base text-navy focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
