import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ConfirmChoice { id: string; label: string; kind?: 'primary' | 'ghost' | 'danger' }
export interface ConfirmRequest { title: string; message: string; choices: ConfirmChoice[]; cancel: string }

/** One app-wide question dialog; `ask` resolves with the chosen id, or the cancel id on Escape. */
export const useConfirmStore = defineStore('confirm', () => {
  const current = ref<ConfirmRequest | null>(null)
  let resolver: ((id: string) => void) | null = null

  function ask(request: ConfirmRequest): Promise<string> {
    resolver?.(current.value?.cancel ?? 'cancel')
    current.value = request
    return new Promise(resolve => { resolver = resolve })
  }

  function answer(id: string): void {
    const r = resolver
    resolver = null
    current.value = null
    r?.(id)
  }

  return { current, ask, answer }
})
