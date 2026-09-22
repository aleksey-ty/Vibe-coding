import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // В dev-режиме frontend обращается к /api, Vite проксирует на backend.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
