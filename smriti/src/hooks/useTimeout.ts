import { useEffect, useRef } from 'react';

/** Vendored small hook (same shape as the reference games' `@/hooks/useTimeout`). Pass `delay: null` to pause. */
export function useTimeout(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null) return;
    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}
