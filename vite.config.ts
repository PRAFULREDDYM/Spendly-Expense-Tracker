import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: [
          'favicon.ico',
          'icons/*.png',
          'icons/*.svg',
          'screenshots/*.png',
          'privacy.html',
          'add-to-siri.json',
          '.well-known/assetlinks.json',
        ],
        manifest: {
          name: 'Expense Tracker',
          short_name: 'Expenses',
          description: 'Track income, expenses, budgets, receipts, and savings from a local-first mobile workspace.',
          theme_color: '#0F1117',
          background_color: '#0F1117',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/?utm_source=pwa',
          lang: 'en',
          categories: ['finance', 'productivity'],
          icons: [
            {
              src: '/icons/icon-72.png',
              sizes: '72x72',
              type: 'image/png',
            },
            {
              src: '/icons/icon-96.png',
              sizes: '96x96',
              type: 'image/png',
            },
            {
              src: '/icons/icon-128.png',
              sizes: '128x128',
              type: 'image/png',
            },
            {
              src: '/icons/icon-144.png',
              sizes: '144x144',
              type: 'image/png',
            },
            {
              src: '/icons/icon-152.png',
              sizes: '152x152',
              type: 'image/png',
            },
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/icon-384.png',
              sizes: '384x384',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Quick Add Expense',
              short_name: 'Add',
              description: 'Add an expense in 3 steps',
              url: '/quick-add',
              icons: [
                {
                  src: '/icons/icon-96.png',
                  sizes: '96x96',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Watch Add',
              short_name: 'Watch',
              description: 'Open the compact quick-add screen for tiny displays',
              url: '/watch-add',
              icons: [
                {
                  src: '/icons/icon-96.png',
                  sizes: '96x96',
                  type: 'image/png',
                },
              ],
            },
          ],
          share_target: {
            action: '/quick-add',
            method: 'GET',
            enctype: 'application/x-www-form-urlencoded',
            params: {
              title: 'description',
              text: 'description',
            },
          },
          screenshots: [
            {
              src: '/screenshots/mobile-dashboard.png',
              sizes: '390x844',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Dashboard',
            },
            {
              src: '/screenshots/mobile-history.png',
              sizes: '390x844',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Transaction History',
            },
            {
              src: '/screenshots/mobile-add.png',
              sizes: '390x844',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Quick Add',
            },
            {
              src: '/screenshots/mobile-analysis.png',
              sizes: '390x844',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Analysis',
            },
            {
              src: '/screenshots/mobile-profile.png',
              sizes: '390x844',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Profile',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          runtimeCaching: [],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    build: {
      sourcemap: false,
      target: 'es2022',
      chunkSizeWarningLimit: 1400,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('heic2any') || id.includes('libheif')) return 'heic-decoder';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor';
            return undefined;
          },
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
});
