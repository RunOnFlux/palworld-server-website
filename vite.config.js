import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import sitemap from 'vite-plugin-sitemap'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      sitemap({
        hostname: env.VITE_APP_URL || 'http://localhost:4000',
        exclude: [
          '/dashboard',
          '/success',
          '/cancel',
        ],
        changefreq: 'weekly',
        priority: 0.7,
        lastmod: new Date(),
        robots: [
          {
            userAgent: '*',
            allow: '/',
            disallow: ['/dashboard/', '/admin/'],
            crawlDelay: 1,
          },
        ],
      }),
      ViteImageOptimizer({
        png: { quality: 80 },
        jpeg: { quality: 80 },
        jpg: { quality: 80 },
        webp: { quality: 80 },
      }),
    ],
    server: {
      port: 4000,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    build: {
      // Code splitting optimization
      rollupOptions: {
        output: {
          manualChunks: {
            // Core vendor chunks
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'ui-vendor': ['framer-motion', 'lucide-react'],

            // Heavy library chunks - loaded on-demand
            'firebase-vendor': [
              'firebase/app',
              'firebase/auth',
            ],
            'terminal-vendor': [
              '@xterm/xterm',
              '@xterm/addon-fit',
              '@xterm/addon-serialize',
              '@xterm/addon-unicode11',
              '@xterm/addon-web-links',
              'socket.io-client',
            ],
          },
        },
      },
      // Chunk size warnings
      chunkSizeWarningLimit: 1000,
      // Minification
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true, // Remove console.logs in production
          drop_debugger: true,
        },
      },
    },
  }
})
