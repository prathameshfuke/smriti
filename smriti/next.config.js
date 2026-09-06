// Workbox matches runtime routes with `regExp.exec(url.href)`, i.e. against the
// full absolute URL. A `^` anchor here would only ever match a bare path, so
// anchored patterns silently never fire and every audio and image request
// falls through to the install-time precache — the worst case on 2G/3G.
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
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
