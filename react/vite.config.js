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
            if (loc) {
              // Debug: log original location header from backend so we can inspect
              // whether the backend is returning absolute URLs containing `proxyserver`.
              // This output appears in the Vite dev server logs.
              try {
                // eslint-disable-next-line no-console
                console.log('[vite-proxy] original Location header:', loc);
              } catch (e) {}

              // Replace any occurrence of the proxyserver host (with or without scheme/port)
              // so the browser does not receive an unresolved hostname. Examples handled:
              //  - http://proxyserver:8080/path -> /path
              //  - proxyserver/api/... -> /api/...
              const newLoc = loc.replace(/(https?:\/\/)?proxyserver(:\d+)?/ig, '');
              let finalLoc = newLoc;
              // Ensure the location is an absolute path for the browser
              if (finalLoc && !finalLoc.startsWith('/')) {
                finalLoc = '/' + finalLoc.replace(/^\/+/, '');
              }

              // Debug: log rewritten location
              try {
                // eslint-disable-next-line no-console
                console.log('[vite-proxy] rewritten Location header:', finalLoc);
              } catch (e) {}

              proxyRes.headers.location = finalLoc;
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