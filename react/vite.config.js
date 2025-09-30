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
    proxy: {
      '/api': {
        target: 'http://proxyserver:8080',
        changeOrigin: true
      },
      '/health': {
        target: 'http://proxyserver:8080',
        changeOrigin: true
      },
      '/ping': {
        target: 'http://proxyserver:8080',
        changeOrigin: true
      }
    }
  }
})