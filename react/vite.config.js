import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      usePolling: true
    },
    // Allow overriding the proxy target with an environment variable so
    // the frontend can be run either inside Docker (where "proxyserver"
    // resolves) or on the host (where you may want to use localhost).
    // Set VITE_PROXY_TARGET or PROXY_TARGET when starting the dev server
    // e.g. in PowerShell: $env:VITE_PROXY_TARGET='http://localhost:8080'; npm run dev
    proxy: (() => {
      const target = process.env.VITE_PROXY_TARGET || process.env.PROXY_TARGET || 'http://proxyserver:8080';
      const makeProxy = (path) => ({
        target,
        changeOrigin: true,
        configure: (proxy) => {
          // Rewrite any Location headers that point back to the proxyserver
          proxy.on('proxyRes', (proxyRes) => {
            const loc = proxyRes.headers && proxyRes.headers.location;
            if (loc && loc.includes('://proxyserver')) {
              // Replace hostname with relative path so the browser stays on localhost
              proxyRes.headers.location = loc.replace(/https?:\/\/proxyserver(:\d+)?/i, '');
            }
          });
        }
      });

      return {
        '/api': makeProxy('/api'),
        '/health': makeProxy('/health'),
        '/ping': makeProxy('/ping')
      };
    })()
  }
})