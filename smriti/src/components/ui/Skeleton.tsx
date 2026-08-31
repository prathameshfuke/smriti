export interface SkeletonProps {
  className?: string;
}

/** Loading placeholder. Decorative, so it is hidden from assistive tech. */
export default function Skeleton({ className = 'h-6 w-full' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-card bg-surface-muted motion-reduce:animate-none ${className}`}
    />
  );
}
