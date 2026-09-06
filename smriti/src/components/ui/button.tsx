import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-primary text-white hover:bg-primary-dark',
  outline: 'border border-line200 bg-paper50 text-navy hover:bg-paper100',
  secondary: 'bg-paper100 text-navy hover:bg-line200/60',
  ghost: 'bg-transparent hover:bg-paper100',
  destructive: 'bg-danger text-white hover:opacity-90',
  link: 'bg-transparent underline text-primary p-0 h-auto',
};

const SIZE_CLASS: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-11 px-5 text-base',
  sm: 'h-9 px-3 text-sm',
  lg: 'h-14 px-8 text-lg',
  icon: 'h-11 w-11 p-0',
};

/** Minimal shadcn-compatible Button — vendored so pasted reference-game components compile unchanged. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
