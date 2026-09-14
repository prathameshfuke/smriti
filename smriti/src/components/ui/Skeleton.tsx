export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

/** Loading placeholder. Decorative, so it is hidden from assistive tech. */
export default function Skeleton({
  width = '100%',
  height = 24,
  className = '',
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{ width, height }}
      className={`animate-pulse rounded-tile bg-surface-muted motion-reduce:animate-none ${className}`}
    />
  );
}
