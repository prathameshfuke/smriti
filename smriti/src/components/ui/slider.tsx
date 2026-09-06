import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps {
  id?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number[];
  onValueChange: (value: number[]) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Minimal shadcn-compatible Slider — vendored so pasted reference-game
 * components compile unchanged. The reference API is array-based (Radix
 * convention, supports multi-thumb sliders); this app only ever uses a
 * single thumb, so it wraps one native range input.
 */
export function Slider({ id, min = 0, max = 100, step = 1, value, onValueChange, disabled, className }: SliderProps) {
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0] ?? min}
      disabled={disabled}
      onChange={(e) => onValueChange([Number(e.target.value)])}
      className={cn('h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed', className)}
    />
  );
}
