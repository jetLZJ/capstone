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
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ping': {
        target: 'http://proxyserver:5000',
        changeOrigin: true
      },
      '/add_data': {
        target: 'http://proxyserver:5000',
        changeOrigin: true
      }
    }
  }
})