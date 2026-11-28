import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useTasksStore } from './tasks'

export type PreviewDevice = 'fill' | 'tablet' | 'mobile'

export const DEVICE_WIDTH: Record<PreviewDevice, number | null> = { fill: null, tablet: 768, mobile: 390 }

/** The built-in preview of the running dev server, shown beside the editor. */
export const usePreviewStore = defineStore('preview', () => {
  const tasks = useTasksStore()
  const visible = ref(false)
  const device = ref<PreviewDevice>('fill')
  const path = ref('/')
  const reloadKey = ref(0)
  /** Address of the last dev server, kept after it stops so the pane can say so. */
  const lastOrigin = ref<string | null>(null)

  const origin = computed(() => {
    const url = tasks.byAction('dev')?.url
    if (!url) return null
    try { return new URL(url).origin } catch { return null }
  })
  const src = computed(() => origin.value ? origin.value + path.value : null)

  function show(url?: string): void {
    if (url) {
      try {
        const u = new URL(url)
        lastOrigin.value = u.origin
        path.value = u.pathname + u.search + u.hash || '/'
      } catch { /* keep the current path */ }
    }
    visible.value = true
  }

  function navigate(input: string): void {
    let next = input.trim()
    if (/^https?:\/\//i.test(next)) {
      try { const u = new URL(next); next = u.pathname + u.search + u.hash } catch { return }
    }
    if (!next.startsWith('/')) next = '/' + next
    path.value = next
    reloadKey.value++
  }

  function reload(): void { reloadKey.value++ }
  function hide(): void { visible.value = false }
  function toggle(): void { visible.value = !visible.value }

  return { visible, device, path, reloadKey, origin, src, lastOrigin, show, navigate, reload, hide, toggle }
})
