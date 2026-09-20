'use client';

import { useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 2000;
const POLL_INTERVAL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 5000;

export function useOfflineStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const commit = (value: boolean) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setIsOnline(value), DEBOUNCE_MS);
    };

    const onOnline = () => commit(true);
    const onOffline = () => commit(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
        commit(res.ok);
      } catch {
        commit(false);
      }
    };
    // Checked once straight away: a phone can report a connection with no
    // usable signal behind it, and waiting a full poll interval left offline
    // screens (Ask Smriti's Memory Bank buttons) hidden for half a minute.
    if (navigator.onLine) void checkHealth();
    const interval = setInterval(() => void checkHealth(), POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { isOnline };
}
