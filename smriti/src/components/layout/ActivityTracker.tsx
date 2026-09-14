'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

const THROTTLE_MS = 30_000;

/**
 * Records the last tap anywhere in the app (at most every 30 seconds). A
 * shared phone uses it to ask "Who is playing?" again after it has been put
 * down for a while, so the next person doesn't play under the last one's
 * name. Renders nothing.
 */
export default function ActivityTracker() {
  useEffect(() => {
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < THROTTLE_MS) return;
      last = now;
      useSettingsStore.getState().touchActivity();
    };
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, []);
  return null;
}
