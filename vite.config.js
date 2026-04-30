import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/PerinApp/', // GitHub Pages repo name
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
