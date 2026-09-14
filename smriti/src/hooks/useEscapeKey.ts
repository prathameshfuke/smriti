'use client';

import { useEffect } from 'react';

/** Calls `onEscape` when Escape is pressed while `active`. Every modal uses
 * this so keyboard and switch users can always back out. */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}
