'use client';

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 600;
const CIRCLE_RADIUS = 28;
const TAP_TOLERANCE_PX = 40;

export interface PathPoint {
  x: number;
  y: number;
  label: number;
}

export interface PathCanvasProps {
  points: PathPoint[];
  /** Index into `points` the patient must tap next. */
  currentTarget: number;
  onPointTap: (index: number) => void;
  completedPath: Array<{ from: number; to: number }>;
  /** True for one 200ms shake cycle after a wrong tap on the current target. */
  wrongTap?: boolean;
}

/**
 * Trail Making Test canvas. A point at index < currentTarget is already
 * connected; the point at currentTarget is the only one the patient should
 * tap next, everything after it is still "upcoming".
 */
export default function PathCanvas({
  points,
  currentTarget,
  onPointTap,
  completedPath,
  wrongTap = false,
}: PathCanvasProps) {
  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = VIEW_WIDTH / rect.width;
    const scaleY = VIEW_HEIGHT / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    let nearestIndex = -1;
    let nearestDistance = Infinity;
    points.forEach((point, index) => {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    if (nearestIndex !== -1 && nearestDistance <= TAP_TOLERANCE_PX) {
      onPointTap(nearestIndex);
    }
  };

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      onPointerDown={handlePointerDown}
      data-testid="path-canvas"
      className="h-full w-full touch-none"
      role="img"
      aria-label="Path connecting puzzle"
    >
      {completedPath.map((segment) => {
        const from = points[segment.from];
        const to = points[segment.to];
        if (!from || !to) return null;
        return (
          <line
            key={`${segment.from}-${segment.to}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            className="stroke-success"
            strokeWidth={3}
          />
        );
      })}

      {points.map((point, index) => {
        const isCompleted = index < currentTarget;
        const isCurrent = index === currentTarget;

        const circleClass = isCompleted
          ? 'fill-success stroke-success stroke-2'
          : isCurrent
            ? 'fill-primary-light stroke-primary stroke-2 animate-pulse-ring motion-reduce:animate-none'
            : 'fill-game-tile stroke-ink-muted stroke-2';

        return (
          <g
            key={index}
            data-testid={`path-point-${index}`}
            className={isCurrent && wrongTap ? 'animate-shake motion-reduce:animate-none' : undefined}
          >
            <circle cx={point.x} cy={point.y} r={CIRCLE_RADIUS} className={circleClass} />
            <text
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="central"
              // `fill-ink` (dark), not `fill-ink-inverse`: unstarted and
              // current-target circles are pale fills (game-tile, primary-light)
              // — near-white text there fell under 2:1 contrast, unreadable.
              className="pointer-events-none select-none text-patient-body font-bold fill-ink"
            >
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
