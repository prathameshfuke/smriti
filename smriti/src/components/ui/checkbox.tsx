import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'checked' | 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/** Minimal shadcn-compatible Checkbox (native input, no Radix) — vendored so pasted reference-game components compile unchanged. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={cn('h-6 w-6 rounded border-2 border-ink-muted text-primary accent-primary', className)}
      {...props}
    />
  ),
);
Checkbox.displayName = 'Checkbox';
