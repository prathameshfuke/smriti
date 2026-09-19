// Workbox matches runtime routes with `regExp.exec(url.href)`, i.e. against the
// full absolute URL. A `^` anchor here would only ever match a bare path, so
// anchored patterns silently never fire and every audio and image request
// falls through to the install-time precache — the worst case on 2G/3G.
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // src/sw/index.ts -> public/worker-<hash>.js, importScripts'd into the generated
  // sw.js: push, notificationclick and periodicsync handlers (reminders while closed).
  customWorkerDir: 'sw',
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // next-pwa only auto-registers a NetworkFirst cache for the exact
    // manifest.json `start_url` path — here that's "/app", but the rule it
    // generates only ever matches the literal string "/". Every other page
    // navigation (including "/app" itself) had no cache entry and no
    // runtime route, so opening the installed app offline hit the network,
    // found nothing, and failed before a single line of app JS ran — not a
    // device-trust bug, a missing document-caching rule. Matching on
    // `request.mode === 'navigate'` (a function predicate, not a regex)
    // covers every route generically, not just "/app".
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        expiration: { maxEntries: 50 },
        networkTimeoutSeconds: 3,
      },
    },
    {
      urlPattern: /\/audio\/.*/,
      handler: 'CacheFirst',
      options: { cacheName: 'audio-assets', expiration: { maxEntries: 500 } }
    },
    {
      urlPattern: /\/images\/.*/,
      handler: 'CacheFirst',
      options: { cacheName: 'game-images', expiration: { maxEntries: 200 } }
    },
    {
      urlPattern: /\/api\/sync/,
      handler: 'NetworkOnly',
    }
  ]
});
module.exports = withPWA({
  reactStrictMode: true,
  webpack: (config) => {
    // Confetti is explicitly out of scope for patient screens per the app's
    // accessibility spec — alias the bare specifier to a local no-op instead
    // of installing (and firing) the real celebratory-particle library.
    config.resolve.alias['canvas-confetti'] = require.resolve(
      './src/lib/stubs/canvas-confetti.ts',
    );
    return config;
  },
});
