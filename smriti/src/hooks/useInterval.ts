import { useEffect, useRef } from 'react';

/** Vendored small hook (same shape as the reference games' `@/hooks/useInterval`). Pass `delay: null` to pause. */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
