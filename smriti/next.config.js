const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^\/audio\/.*/,
      handler: 'CacheFirst',
      options: { cacheName: 'audio-assets', expiration: { maxEntries: 500 } }
    },
    {
      urlPattern: /^\/images\/.*/,
      handler: 'CacheFirst',
      options: { cacheName: 'game-images', expiration: { maxEntries: 200 } }
    },
    {
      urlPattern: /\/api\/sync/,
      handler: 'NetworkOnly',
    }
  ]
});
module.exports = withPWA({ reactStrictMode: true });
