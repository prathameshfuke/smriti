/**
 * Icon: the one way to render a Lucide icon in SMRITI.
 *
 * Defaults every icon to strokeWidth 2.5 instead of Lucide's 2. The heavier
 * line holds up at 16–24px for low-vision readers, and keeps icons optically
 * matched to Atkinson Hyperlegible's bold labels. Any prop can still be
 * overridden per use.
 *
 * Icons here are decorative by default (aria-hidden), because every icon in
 * the app sits next to a visible text label. Pass `aria-label` for the rare
 * icon that has to stand alone, and it becomes a labelled image instead.
 *
 * No "use client": this renders a plain SVG with no state or effects, so it
 * works unchanged in Server and Client Components.
 *
 * Usage:
 *
 *   import { Heart, Search, Settings } from 'lucide-react';
 *   import Icon from '@/components/Icon';
 *
 *   <Icon icon={Heart} size={24} />
 *   <Icon icon={Search} size={20} className="text-ink-muted" />
 *   <Icon icon={Settings} strokeWidth={2} aria-label="Settings" />
 */
import type { LucideIcon, LucideProps } from 'lucide-react';

export interface IconProps extends LucideProps {
  /** The Lucide icon component to render, e.g. `Heart` from 'lucide-react'. */
  icon: LucideIcon;
}

export const DEFAULT_ICON_STROKE_WIDTH = 2.5;

export default function Icon({
  icon: LucideComponent,
  strokeWidth = DEFAULT_ICON_STROKE_WIDTH,
  ...props
}: IconProps) {
  const labelled = Boolean(props['aria-label']);
  return (
    <LucideComponent
      strokeWidth={strokeWidth}
      aria-hidden={labelled ? undefined : true}
      role={labelled ? 'img' : undefined}
      {...props}
    />
  );
}
