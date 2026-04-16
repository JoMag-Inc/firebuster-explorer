import { defineConfig } from 'vite'

// Proxies browser requests to local services, avoiding CORS issues.
export default defineConfig({
  server: {
    proxy: {
      '/realms': { target: 'http://localhost:8080', changeOrigin: true },
      '/api':    { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
