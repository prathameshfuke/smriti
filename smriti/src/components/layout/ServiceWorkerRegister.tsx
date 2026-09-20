'use client';

import { useEffect } from 'react';
import { warmOfflinePages } from '@/lib/pwa/offlineRoutes';

/**
 * Registers the Workbox service worker that next-pwa builds into /sw.js.
 *
 * next-pwa's own `register: true` only injects its registration call into the
 * Pages Router `main.js` bundle. This app is App Router only, which never
 * loads that bundle, so the worker was built but never installed: no page was
 * ever cached, and a returning patient opening the app without signal got the
 * browser's offline error before any app code ran. Registering here, from the
 * root layout, covers every route.
 *
 * Production only, matching `disable` in next.config.js — there is no worker
 * in `next dev`.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        if (navigator.onLine) return warmOfflinePages();
      })
      .catch((err) => {
        console.error('[pwa] service worker registration failed', err);
      });
  }, []);
  return null;
}
