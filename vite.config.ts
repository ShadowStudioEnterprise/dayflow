import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    watch: {
      ignored: [
        '**/android/**',
        '**/ios/**',
        '**/.toolchains/**',
        '**/dist-pwa-test/**',
        '**/test-results/**',
        '**/test-results-pwa/**',
        '**/test-results-local/**',
        '**/supabase/.temp/**',
      ],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      injectRegister: null,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'Dayflow',
        short_name: 'Dayflow',
        description:
          'Organiza tus notas, tareas, calendario y recordatorios en un solo lugar.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#7562b4',
        background_color: '#f8f7fb',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        importScripts: ['/push-worker.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [
          /^\/(?:$|\?|(?:setup|auth|tasks|notes|calendar|reminders|inbox|tags|search|settings|profile)(?:[/?]|$))/,
        ],
        // Keep the current version alive until every tab closes: no forced reload of drafts.
        skipWaiting: false,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'validation', test: /node_modules[\\/]zod[\\/]/ },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
