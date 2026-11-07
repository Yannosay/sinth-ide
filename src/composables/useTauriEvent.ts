import { onUnmounted, ref, type Ref } from 'vue'
import { listen, type UnlistenFn, type EventCallback } from '@tauri-apps/api/event'

export function useTauriEvent<T>(event: string, handler: EventCallback<T>): { ready: Ref<boolean>; unlisten: () => void } {
  const ready = ref(false)
  let dispose: UnlistenFn | null = null

  void listen<T>(event, handler).then(fn => {
    dispose = fn
    ready.value = true
  })

  function unlisten(): void {
    if (dispose) {
      try { dispose() } catch { void 0 }
      dispose = null
      ready.value = false
    }
  }

  onUnmounted(unlisten)
  return { ready, unlisten }
}