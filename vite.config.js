import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sitemap from 'vite-plugin-sitemap'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      sitemap({
        // Hardcoded so the sitemap <loc> (and the plugin-generated robots.txt
        // Sitemap URL) is never the localhost dev proxy target from .env.
        hostname: 'https://palworld.runonflux.com',
        // SPA routes the plugin can't discover from the single index.html entry.
        // These are the indexable content/guide pages plus /support.
        dynamicRoutes: [
          '/pricing',
          '/setup-guide',
          '/server-requirements',
          '/guides/join-server',
          '/guides/server-settings',
          '/support',
        ],
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
            disallow: ['/dashboard/', '/admin/', '/success', '/cancel'],
            crawlDelay: 1,
          },
          // Explicitly allow the major AI crawlers so the site can be cited in
          // generative answers (ChatGPT, Claude, Perplexity, Google AI Overviews).
          { userAgent: 'GPTBot', allow: '/' },
          { userAgent: 'OAI-SearchBot', allow: '/' },
          { userAgent: 'ChatGPT-User', allow: '/' },
          { userAgent: 'ClaudeBot', allow: '/' },
          { userAgent: 'Claude-Web', allow: '/' },
          { userAgent: 'anthropic-ai', allow: '/' },
          { userAgent: 'PerplexityBot', allow: '/' },
          { userAgent: 'Perplexity-User', allow: '/' },
          { userAgent: 'Google-Extended', allow: '/' },
          { userAgent: 'Applebot-Extended', allow: '/' },
          { userAgent: 'CCBot', allow: '/' },
          { userAgent: 'Bytespider', allow: '/' },
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
