import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'White Glove Source',
        short_name: 'WGS',
        description: 'Premium furniture logistics for interior designers',
        theme_color: '#1c1c1c',
        background_color: '#f8f5f0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2,jpg,jpeg,png,webp}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/projects\/demo/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'demo-project',
              expiration: { maxEntries: 1, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /\/api\/projects\/.+/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'projects-api',
              expiration: { maxEntries: 20, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
