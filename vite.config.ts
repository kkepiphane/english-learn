import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

/**
 * GitHub Pages serves a project site under /<repo>/. The deploy workflow sets BASE_PATH from the
 * repository name (or "/" for a <user>.github.io repo / custom domain). Locally it defaults to "/".
 */
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'English Path',
        short_name: 'English Path',
        description: 'Your personal English tutor — A2 to C1, IELTS & TOEFL preparation, works offline.',
        theme_color: '#6d38ef',
        background_color: '#0f0d1a',
        display: 'standalone',
        orientation: 'any',
        id: base,
        start_url: base,
        scope: base,
        lang: 'en',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + all bundled content (lessons are bundled JSON) are precached.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Optional audio files / content packs added later under /content/: cached on first play, then offline.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && (url.pathname.includes('/content/') || /\.(mp3|m4a|ogg|webm)$/.test(url.pathname)),
            handler: 'CacheFirst',
            options: { cacheName: 'ep-content', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 }, rangeRequests: true },
          },
          // AI proxy calls are cross-origin and never cached (no runtime rule = network only).
        ],
      },
    }),
  ],
  test: { environment: 'node', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.ts'] },
} as never)
