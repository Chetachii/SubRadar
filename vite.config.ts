import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifestJson from './manifest.json'
import fs from 'fs'
import path from 'path'

// Strip content_scripts so CRXJS never generates a dynamic-import loader.
// The content script is built as a self-contained IIFE by vite.content.config.ts
// and injected into the output manifest by the plugin below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { content_scripts: _cs, ...crxManifestBase } = manifestJson
const crxManifest = { ...crxManifestBase, content_scripts: [] as typeof manifestJson.content_scripts }

function injectContentScript(): Plugin {
  return {
    name: 'subradar-inject-content-script',
    apply: 'build',
    closeBundle() {
      const distManifestPath = path.resolve(__dirname, 'dist/manifest.json')
      if (!fs.existsSync(distManifestPath)) return
      const m = JSON.parse(fs.readFileSync(distManifestPath, 'utf-8'))
      m.content_scripts = [{
        matches: ['<all_urls>'],
        js: ['content.js'],
        run_at: 'document_idle',
      }]
      fs.writeFileSync(distManifestPath, JSON.stringify(m, null, 2))
    },
  }
}

const isTest = !!process.env.VITEST

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: isTest ? [react()] : [react(), crx({ manifest: crxManifest }), injectContentScript()],
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
