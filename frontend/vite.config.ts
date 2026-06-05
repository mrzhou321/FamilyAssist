import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared') },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  build: {
    rollupOptions: {
      input: {
        mobile: resolve(__dirname, 'mobile/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
})
