import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // 更新があった時にユーザーへ通知
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: '工程表',
        short_name: '工程表',
        description: '工程表管理アプリ',
        theme_color: '#1565c0',
        background_color: '#f5f5f5',
        display: 'standalone',
        start_url: '/',
        lang: 'ja',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // HTMLは毎回ネットワーク優先で確認
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'firestore-cache' },
          },
        ],
      },
    }),
  ],
  base: './',
  build: {
    outDir: 'dist-viewer',
    rollupOptions: {
      input: 'viewer.html',
    },
  },
})
