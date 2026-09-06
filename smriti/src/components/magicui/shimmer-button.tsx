import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * The reference project's "shimmer" is a decorative marketing flourish
 * (magicui component library, not part of this app's design system) — this
 * app's spec avoids decorative motion beyond functional feedback, so this
 * re-exports the plain vendored Button under the same name/path.
 */
export const ShimmerButton = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button ref={ref} {...props} />
));
ShimmerButton.displayName = 'ShimmerButton';
