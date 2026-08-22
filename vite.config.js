import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vite.dev/config/
//
// `isSsrBuild` is true for `vite build --ssr src/entry-server.jsx` (see the
// build:ssr script), which produces the bundle scripts/prerender.mjs renders with.
// The sitemap, image optimizer and manualChunks all belong to the client bundle
// only — applying them to the SSR build emits duplicate assets and makes Rollup
// fail, since react is external there.
export default defineConfig(({ isSsrBuild }) => {
  return {
    plugins: [
      react(),
      // The sitemap is written by scripts/prerender.mjs, from the same route table that
      // decides which shells exist. The plugin needed its own hand-maintained copy of
      // that list and could only stamp one build-time lastmod across every URL.
      !isSsrBuild && ViteImageOptimizer({
        png: { quality: 80 },
        jpeg: { quality: 80 },
        jpg: { quality: 80 },
        webp: { quality: 80 },
      }),
    ].filter(Boolean),
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
      // Code splitting optimization. Vendor chunking is client-only: in the SSR
      // build react & friends are external, and Rollup refuses to chunk externals.
      rollupOptions: {
        output: isSsrBuild ? {} : {
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
