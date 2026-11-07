import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TerminalInstance {
  id: number
  title: string
  cwd: string
  alive: boolean
}

export const useTerminalStore = defineStore('terminal', () => {
  const instances = ref<TerminalInstance[]>([])
  const activeId = ref<number | null>(null)

  function register(instance: TerminalInstance): void {
    instances.value.push(instance)
    activeId.value = instance.id
  }
  function setActive(id: number): void {
    if (instances.value.some(i => i.id === id)) activeId.value = id
  }
  function unregister(id: number): void {
    const idx = instances.value.findIndex(i => i.id === id)
    if (idx < 0) return
    instances.value.splice(idx, 1)
    if (activeId.value === id) {
      const next = instances.value[idx] ?? instances.value[idx - 1] ?? null
      activeId.value = next ? next.id : null
    }
  }
  function markDead(id: number): void {
    const inst = instances.value.find(i => i.id === id)
    if (inst) inst.alive = false
  }

  return { instances, activeId, register, setActive, unregister, markDead }
})