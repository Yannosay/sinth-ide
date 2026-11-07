/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '*?worker' {
  const workerConstructor: { new (options?: { name?: string }): Worker }
  export default workerConstructor
}