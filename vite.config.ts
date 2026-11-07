import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 5174 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] }
  },
  worker: { format: 'es' },
  build: { target: 'esnext', minify: 'esbuild', sourcemap: false, chunkSizeWarningLimit: 4096 },
  optimizeDeps: { include: ['monaco-editor/esm/vs/editor/editor.api'] }
})