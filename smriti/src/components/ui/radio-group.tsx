import * as React from 'react';
import { cn } from '@/lib/utils';

interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  name: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string;
  onValueChange?: (value: string) => void;
}

/** Minimal shadcn-compatible RadioGroup (native inputs, no Radix) — vendored so pasted reference-game components compile unchanged. */
export function RadioGroup({ value, onValueChange, className, children, ...props }: RadioGroupProps) {
  const name = React.useId();
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, name }}>
      <div role="radiogroup" className={cn('flex flex-col gap-2', className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'> {
  value: string;
}

export const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext);
    return (
      <input
        ref={ref}
        type="radio"
        name={ctx?.name}
        checked={ctx?.value === value}
        onChange={() => ctx?.onValueChange?.(value)}
        className={cn('h-5 w-5 accent-primary', className)}
        {...props}
      />
    );
  },
);
RadioGroupItem.displayName = 'RadioGroupItem';
