import { useCallback, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';

const MOVE_THRESHOLD_PX = 10;
/** Blocks the native `click` that follows a handled pointerup, so one press
 * never fires the selection twice (once from the pointer handler, once from
 * the browser's own click). */
const CLICK_SUPPRESS_MS = 400;

export interface TapSelectHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: ReactMouseEvent) => void;
  onClick: () => void;
  style: CSSProperties;
}

const TAP_SELECT_STYLE: CSSProperties = {
  touchAction: 'manipulation',
  WebkitTouchCallout: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
};

/**
 * Returns a factory for tile/tile-like selection handlers: a press registers
 * on release no matter how long the finger was down, so a light touch and a
 * long press-and-hold both count. Game tiles previously only wired
 * `onClick`, which iOS/Android can drop after a long hold turns into a
 * text-selection/callout gesture instead of a tap. `onContextMenu` and the
 * native touch callout are suppressed so a long hold never opens a menu
 * instead of selecting.
 *
 * Call the hook once per component (its shared press state covers every
 * tile, since only one pointer can be down at a time), then call the
 * returned factory per tile inside a map — never call this hook itself
 * inside a loop.
 *
 * Spread the returned handlers onto the tappable element and merge `style`
 * into its own style prop; keep the element's existing `disabled` handling
 * — `enabled` here only gates whether a press counts, not focusability.
 */
export function useTapSelect(): (onSelect: () => void, enabled?: boolean) => TapSelectHandlers {
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClickUntilRef = useRef(0);

  return useCallback((onSelect: () => void, enabled = true): TapSelectHandlers => {
    const fire = () => {
      if (!enabled) return;
      suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
      onSelect();
    };

    return {
      onPointerDown: (e) => {
        if (!enabled) return;
        startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      },
      onPointerUp: (e) => {
        const start = startRef.current;
        startRef.current = null;
        if (!enabled || !start || start.id !== e.pointerId) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) return;
        fire();
      },
      onPointerCancel: () => {
        startRef.current = null;
      },
      onPointerLeave: () => {
        startRef.current = null;
      },
      onContextMenu: (e) => {
        e.preventDefault();
      },
      // Covers keyboard activation (Enter/Space fire `click` with no pointer
      // events) and any pointer path whose click still lands natively;
      // guarded against double-firing right after the pointer handler
      // already selected for this same press.
      onClick: () => {
        if (!enabled) return;
        if (Date.now() < suppressClickUntilRef.current) return;
        onSelect();
      },
      style: TAP_SELECT_STYLE,
    };
  }, []);
}
