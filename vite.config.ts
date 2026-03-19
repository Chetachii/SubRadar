import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

const isTest = !!process.env.VITEST

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: isTest ? [react()] : [react(), crx({ manifest })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/test/**'],
    },
  },
})
