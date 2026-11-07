import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface SinthDiagnostic {
  severity: 'error' | 'warning'
  code: string
  message: string
  hint?: string
  loc?: { file: string; line: number; col: number; length?: number }
}

interface CheckResult {
  version: number
  errors: SinthDiagnostic[]
  warnings: SinthDiagnostic[]
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

export const useDiagnosticsStore = defineStore('diagnostics', () => {
  const items = ref<SinthDiagnostic[]>([])
  const running = ref(false)
  const lastError = ref<string | null>(null)
  const revision = ref(0)
  let queued: string | null = null

  const errorCount = computed(() => items.value.filter(d => d.severity === 'error').length)
  const warningCount = computed(() => items.value.filter(d => d.severity === 'warning').length)

  function forFile(path: string): SinthDiagnostic[] {
    const key = normalizePath(path)
    return items.value.filter(d => d.loc && normalizePath(d.loc.file) === key)
  }

  async function check(root: string): Promise<void> {
    if (running.value) {
      queued = root
      return
    }
    running.value = true
    try {
      const raw = await invoke<string>('sinth_check', { root })
      const parsed = JSON.parse(raw) as CheckResult
      items.value = [...parsed.errors, ...parsed.warnings]
      lastError.value = null
    } catch (err) {
      lastError.value = String(err)
      // Without Node.js or a compiler there is nothing to check; stale results would be misleading.
      if (lastError.value === 'NO_COMPILER' || lastError.value === 'NO_NODE') items.value = []
    } finally {
      running.value = false
      revision.value++
      if (queued) {
        const next = queued
        queued = null
        void check(next)
      }
    }
  }

  function clear(): void {
    items.value = []
    revision.value++
  }

  return { items, running, lastError, revision, errorCount, warningCount, forFile, check, clear }
})
