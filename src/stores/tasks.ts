import { defineStore } from 'pinia'
import { ref } from 'vue'

/** A project action (Run, Build, ...) running in its own terminal. */
export interface RunningTask {
  actionId: string
  terminalId: number
  /** Local server address printed by `sinth dev` / `sinth preview`, once known. */
  url: string | null
}

export const useTasksStore = defineStore('tasks', () => {
  const running = ref<RunningTask[]>([])

  function byAction(actionId: string): RunningTask | undefined {
    return running.value.find(t => t.actionId === actionId)
  }

  function byTerminal(terminalId: number): RunningTask | undefined {
    return running.value.find(t => t.terminalId === terminalId)
  }

  function start(actionId: string, terminalId: number): void {
    running.value = [...running.value.filter(t => t.actionId !== actionId), { actionId, terminalId, url: null }]
  }

  function finish(terminalId: number): void {
    running.value = running.value.filter(t => t.terminalId !== terminalId)
  }

  return { running, byAction, byTerminal, start, finish }
})
