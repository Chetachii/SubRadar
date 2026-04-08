import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Builds the content script as a single self-contained IIFE with no dynamic
// imports or code splitting. Runs after the main build (emptyOutDir: false).
export default defineConfig({
  plugins: [react()],
  // Replace Node.js globals that React and other libs reference but that don't
  // exist in a browser IIFE context. All VITE_ env vars are inlined here too.
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'SubRadarContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
