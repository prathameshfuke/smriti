import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

export interface RippleButtonProps extends ButtonProps {
  /** Decorative-only in the reference project; accepted and dropped here. */
  rippleColor?: string;
  rippleDuration?: string;
}

/**
 * The reference project's ripple effect is a decorative flourish — re-export
 * of the plain vendored Button under the same name/path (see
 * shimmer-button.tsx for the same reasoning).
 */
export const RippleButton = React.forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({ rippleColor: _rippleColor, rippleDuration: _rippleDuration, ...props }, ref) => (
    <Button ref={ref} {...props} />
  ),
);
RippleButton.displayName = 'RippleButton';
