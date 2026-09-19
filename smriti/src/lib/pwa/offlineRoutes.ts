/**
 * Every statically rendered page, stored in the service worker's `pages`
 * cache as soon as the app is opened online (see ServiceWorkerRegister).
 *
 * The navigation rule in next.config.js is NetworkFirst, so it only has a
 * page to fall back on once that page has been fetched online at least once.
 * A patient who had only ever opened the home screen could not start any
 * game they hadn't played yet once the signal dropped. Warming all of them
 * up front means the first online launch after setup is enough.
 *
 * Dynamic routes (`/caregiver/patients/[id]`, `/family/[id]`) are left to the
 * runtime cache: they are cached when visited.
 *
 * Kept in step with src/app by src/tests/offline-routes.test.ts.
 */
export const OFFLINE_ROUTES = [
  '/',
  '/app',
  '/login',
  '/companion',
  '/reminders',
  '/caregiver/add-patient',
  '/caregiver/consent',
  '/caregiver/dashboard',
  '/caregiver/device',
  '/caregiver/login',
  '/caregiver/login/callback',
  '/caregiver/memory-bank',
  '/caregiver/onboarding',
  '/caregiver/patients',
  '/caregiver/settings',
  '/games/counting-boxes',
  '/games/double-decision',
  '/games/fish-trace',
  '/games/frog-leap',
  '/games/larger-number',
  '/games/memory-blocks',
  '/games/memory-match',
  '/games/memory-span',
  '/games/n-back',
  '/games/object-hunt',
  '/games/path-match',
  '/games/quick-tap',
  '/games/reminiscence-quiz',
  '/games/routine-recall',
  '/games/word-stream',
] as const;

/** Must match `cacheName` of the navigation rule in next.config.js. */
export const PAGES_CACHE = 'pages';

/**
 * Fetches every route and stores it in the pages cache. Best effort: a page
 * that fails to load keeps whatever copy the cache already had.
 */
export async function warmOfflinePages(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(PAGES_CACHE);
  await Promise.all(
    OFFLINE_ROUTES.map(async (route) => {
      try {
        const res = await fetch(route, { credentials: 'same-origin', cache: 'no-store' });
        if (res.ok && !res.redirected) await cache.put(route, res);
      } catch {
        // Offline or flaky: keep the previous copy.
      }
    }),
  );
}
