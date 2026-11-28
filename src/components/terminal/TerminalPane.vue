<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '@/stores/terminal'
import { useSettingsStore } from '@/stores/settings'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTasksStore } from '@/stores/tasks'
import { usePreviewStore } from '@/stores/preview'
import IconButton from '@/components/ui/IconButton.vue'

const height = defineModel<number>('height', { required: true })

const store = useTerminalStore()
const settings = useSettingsStore()
const workspace = useWorkspaceStore()
const tasks = useTasksStore()
const preview = usePreviewStore()

/** A project action that runs in its own terminal and exits when done. */
export interface TaskRequest {
  actionId: string
  title: string
  command: string
  /** Where the server address opens once it is printed. */
  open: 'preview' | 'browser' | null
}

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g
const SERVER_URL = /(?:Local|Preview):\s+(https?:\/\/[^\s]+)/

interface Runtime {
  id: number
  term: Terminal
  fit: FitAddon
  search: SearchAddon
  container: HTMLDivElement
  unlisten: UnlistenFn | null
  cwd: string
  userInteracted: boolean
  task: TaskRequest | null
  /** Recent plain-text output of a task, scanned for the server address. */
  tail: string
}

const runtimes = ref<Runtime[]>([])
// Output that arrives before a terminal's xterm instance exists (the first shell prompt) waits here.
const pendingOutput = new Map<number, string[]>()
const exited = new Set<number>()
let globalUnlisten: UnlistenFn[] = []
let resizeObserver: ResizeObserver | null = null
const hostRef = ref<HTMLDivElement | null>(null)
const searchVisible = ref(false)
const searchQuery = ref('')

function createNode(id: number): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'terminal-instance'
  el.dataset.terminalId = String(id)
  el.style.display = 'none'
  return el
}

async function spawnTerminal(cwdOverride?: string, task: TaskRequest | null = null): Promise<number | null> {
  if (!hostRef.value) return null

  const cwd = cwdOverride ?? workspace.rootPath ?? ''
  const cols = 120
  const rows = 30
  const shell = settings.terminalShell || undefined

  let id: number
  try {
    id = await invoke<number>('spawn_terminal', { cwd, shell, cols, rows, command: task?.command ?? null })
  } catch (err) {
    console.error('[terminal] spawn failed:', err)
    return null
  }

  const container = createNode(id)
  hostRef.value.appendChild(container)

  const term = new Terminal({
    fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
    fontSize: settings.terminalFontSize,
    cursorBlink: true,
    cursorStyle: 'bar',
    allowTransparency: true,
    scrollback: 10000,
    theme: {
      background: '#0a0a0b',
      foreground: '#e4e4e7',
      cursor: '#a78bfa',
      cursorAccent: '#0a0a0b',
      selectionBackground: 'rgba(167, 139, 250, 0.28)',
      black: '#0a0a0b', red: '#f87171', green: '#4ade80', yellow: '#fbbf24',
      blue: '#60a5fa', magenta: '#a78bfa', cyan: '#67e8f9', white: '#e4e4e7',
      brightBlack: '#71717a', brightRed: '#fca5a5', brightGreen: '#86efac', brightYellow: '#fde68a',
      brightBlue: '#93c5fd', brightMagenta: '#c4b5fd', brightCyan: '#a5f3fc', brightWhite: '#fafafa'
    }
  })

  const fit = new FitAddon()
  const search = new SearchAddon()
  term.loadAddon(fit)
  term.loadAddon(search)
  term.loadAddon(new WebLinksAddon((event, uri) => {
    if (event.ctrlKey || event.metaKey) void openExternal(uri).catch(err => console.error('[terminal] open link failed:', err))
  }))

  term.open(container)
  await nextTick()
  fit.fit()

  term.onData(data => {
    const rt = runtimes.value.find(r => r.id === id)
    if (rt) rt.userInteracted = true
    if (!isAlive(id)) {
      if (data === '\r') void restartTerminal(id)
      return
    }
    invoke('write_terminal', { id, data }).catch(() => store.markDead(id))
  })

  term.onResize(({ cols: c, rows: r }) => { void invoke('resize_terminal', { id, cols: c, rows: r }).catch(() => undefined) })

  runtimes.value.push({ id, term, fit, search, container, unlisten: null, cwd, userInteracted: !!task, task, tail: '' })
  if (task) tasks.start(task.actionId, id)
  for (const chunk of pendingOutput.get(id) ?? []) writeOutput(id, chunk)
  pendingOutput.delete(id)

  const title = task ? task.title : `Terminal ${store.instances.length + 1}`
  store.register({ id, title, cwd, alive: true })
  if (exited.has(id)) onExit(id)
  setActive(id)
  return id
}

function setActive(id: number): void {
  store.setActive(id)
  for (const rt of runtimes.value) rt.container.style.display = rt.id === id ? 'block' : 'none'
  const rt = runtimes.value.find(r => r.id === id)
  if (rt) {
    rt.term.focus()
    requestAnimationFrame(() => rt.fit.fit())
  }
}

async function closeTerminal(id: number): Promise<void> {
  try { await invoke('kill_terminal', { id }) } catch { void 0 }
  tasks.finish(id)
  const rt = runtimes.value.find(r => r.id === id)
  if (rt) {
    rt.unlisten?.()
    rt.term.dispose()
    rt.container.remove()
    runtimes.value = runtimes.value.filter(r => r.id !== id)
  }
  store.unregister(id)
  const next = store.activeId
  if (next !== null) setActive(next)
}

async function restartTerminal(id: number): Promise<void> {
  const rt = runtimes.value.find(r => r.id === id)
  if (!rt) return
  const cwd = rt.cwd || workspace.rootPath || ''
  const task = rt.task
  await closeTerminal(id)
  await spawnTerminal(cwd, task)
}

/** Writes output and, for Run and Preview tasks, opens the server address once it is printed. */
function writeOutput(id: number, data: string): void {
  const rt = runtimes.value.find(r => r.id === id)
  if (!rt) return
  rt.term.write(data)
  const running = tasks.byTerminal(id)
  if (!rt.task || !running || running.url) return
  rt.tail = (rt.tail + data.replace(ANSI, '')).slice(-2048)
  const match = rt.tail.match(SERVER_URL)
  if (!match) return
  running.url = match[1]
  if (rt.task.open === 'preview') preview.show(match[1])
  else if (rt.task.open === 'browser') void openExternal(match[1]).catch(err => console.error('[terminal] open browser failed:', err))
}

async function runTask(task: TaskRequest): Promise<void> {
  const running = tasks.byAction(task.actionId)
  if (running && isAlive(running.terminalId)) {
    setActive(running.terminalId)
    return
  }
  const stale = runtimes.value.find(r => r.task?.actionId === task.actionId)
  if (stale) await closeTerminal(stale.id)
  await spawnTerminal(workspace.rootPath ?? undefined, task)
}

/** Stops a task with Ctrl+C so the server shuts down cleanly, then force-kills it if it is still running. */
async function stopTask(actionId: string): Promise<void> {
  const running = tasks.byAction(actionId)
  if (!running) return
  const id = running.terminalId
  try { await invoke('write_terminal', { id, data: '\x03' }) } catch { void 0 }
  setTimeout(() => {
    if (tasks.byTerminal(id)) void invoke('kill_terminal', { id }).catch(() => undefined).finally(() => { if (tasks.byTerminal(id)) onExit(id) })
  }, 1500)
}

function onResize(): void {
  for (const rt of runtimes.value) { try { rt.fit.fit() } catch { void 0 } }
}

function runSearch(): void {
  const rt = runtimes.value.find(r => r.id === store.activeId)
  if (!rt || !searchQuery.value) return
  rt.search.findNext(searchQuery.value)
}

async function newTerminal(): Promise<void> {
  await spawnTerminal(workspace.rootPath ?? undefined)
}

function isAlive(id: number | null): id is number {
  return id !== null && store.instances.some(i => i.id === id && i.alive)
}

async function ensureTerminal(): Promise<number | null> {
  if (isAlive(store.activeId)) return store.activeId
  const alive = store.instances.find(i => i.alive)
  if (alive) return alive.id
  return await spawnTerminal(workspace.rootPath ?? undefined)
}

async function runCommandInActive(command: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = await ensureTerminal()
    if (id === null) return
    const rt = runtimes.value.find(r => r.id === id)
    if (rt) rt.userInteracted = true
    setActive(id)
    try {
      await invoke('write_terminal', { id, data: command + '\r' })
      return
    } catch {
      store.markDead(id)
    }
  }
}

function onExit(id: number): void {
  if (!isAlive(id) && !tasks.byTerminal(id)) return
  store.markDead(id)
  tasks.finish(id)
  const rt = runtimes.value.find(r => r.id === id)
  const what = rt?.task ? 'task finished, press Enter to run it again' : 'process exited, press Enter to restart'
  rt?.term.write(`\r\n\x1b[2m[${what}]\x1b[0m\r\n`)
}

async function interruptActive(): Promise<void> {
  const id = store.activeId
  if (!isAlive(id)) return
  try { await invoke('write_terminal', { id, data: '\x03' }) } catch { store.markDead(id) }
}

function clearActive(): void {
  const rt = runtimes.value.find(r => r.id === store.activeId)
  if (rt) rt.term.clear()
}

function onRunEvent(e: Event): void {
  const ce = e as CustomEvent<{ command: string }>
  if (!ce.detail?.command) return
  void runCommandInActive(ce.detail.command)
}

function onInterruptEvent(): void {
  void interruptActive()
}

function onClearEvent(): void {
  clearActive()
}

function onNewTerminalEvent(): void {
  void newTerminal()
}

function onTaskRunEvent(e: Event): void {
  const detail = (e as CustomEvent<TaskRequest>).detail
  if (detail?.command) void runTask(detail)
}

function onTaskStopEvent(e: Event): void {
  const detail = (e as CustomEvent<{ actionId: string }>).detail
  if (detail?.actionId) void stopTask(detail.actionId)
}

onMounted(async () => {
  globalUnlisten = await Promise.all([
    listen<{ id: number; data: string }>('terminal-output', ev => {
      if (runtimes.value.some(r => r.id === ev.payload.id)) writeOutput(ev.payload.id, ev.payload.data)
      else pendingOutput.set(ev.payload.id, [...(pendingOutput.get(ev.payload.id) ?? []), ev.payload.data])
    }),
    listen<{ id: number }>('terminal-exit', ev => {
      exited.add(ev.payload.id)
      if (runtimes.value.some(r => r.id === ev.payload.id)) onExit(ev.payload.id)
    }),
  ])
  window.addEventListener('resize', onResize)
  // Refit whenever the panel itself changes size (sidebar drag, panel shown, first layout).
  if (hostRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (hostRef.value && hostRef.value.clientWidth > 0) requestAnimationFrame(onResize)
    })
    resizeObserver.observe(hostRef.value)
  }
  window.addEventListener('sinth:new-terminal', onNewTerminalEvent)
  window.addEventListener('sinth:terminal-run', onRunEvent)
  window.addEventListener('sinth:terminal-interrupt', onInterruptEvent)
  window.addEventListener('sinth:terminal-clear', onClearEvent)
  window.addEventListener('sinth:task-run', onTaskRunEvent)
  window.addEventListener('sinth:task-stop', onTaskStopEvent)

  await spawnTerminal(workspace.rootPath ?? undefined)
})

onBeforeUnmount(() => {
  for (const u of globalUnlisten) u()
  globalUnlisten = []
  resizeObserver?.disconnect()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('sinth:new-terminal', onNewTerminalEvent)
  window.removeEventListener('sinth:terminal-run', onRunEvent)
  window.removeEventListener('sinth:terminal-interrupt', onInterruptEvent)
  window.removeEventListener('sinth:terminal-clear', onClearEvent)
  window.removeEventListener('sinth:task-run', onTaskRunEvent)
  window.removeEventListener('sinth:task-stop', onTaskStopEvent)
  for (const rt of runtimes.value) {
    rt.unlisten?.()
    rt.term.dispose()
    rt.container.remove()
  }
  runtimes.value = []
})

watch(() => settings.terminalFontSize, v => {
  for (const rt of runtimes.value) {
    rt.term.options.fontSize = v
    rt.fit.fit()
  }
})

watch(height, () => requestAnimationFrame(onResize))

watch(() => workspace.rootPath, async (next, prev) => {
  if (!next || next === prev) return
  for (const rt of runtimes.value) {
    if (!rt.userInteracted && rt.cwd !== next) {
      await restartTerminal(rt.id)
    }
  }
})
</script>

<template>
  <div class="terminal" :style="{ height: height + 'px' }">
    <header class="terminal__header">
      <div class="terminal__tabs">
        <button
          v-for="inst in store.instances"
          :key="inst.id"
          type="button"
          class="terminal__tab"
          :class="{ 'terminal__tab--active': inst.id === store.activeId, 'terminal__tab--dead': !inst.alive }"
          @click="setActive(inst.id)"
        >
          <span class="terminal__tab-label truncate">{{ inst.title }}</span>
          <span class="terminal__tab-close" role="button" :title="`Close ${inst.title}`" @click.stop="closeTerminal(inst.id)">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </span>
        </button>
      </div>
      <div class="terminal__actions">
        <div v-if="searchVisible" class="terminal__search">
          <input v-model="searchQuery" type="search" placeholder="Find" @keydown.enter="runSearch">
        </div>
        <IconButton title="Restart active shell" size="sm" :disabled="store.activeId === null" @click="() => { if (store.activeId !== null) restartTerminal(store.activeId) }">
          <svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
        </IconButton>
        <IconButton title="Find" size="sm" @click="searchVisible = !searchVisible">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </IconButton>
        <IconButton title="Clear" size="sm" :disabled="store.activeId === null" @click="clearActive">
          <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /></svg>
        </IconButton>
        <IconButton title="New terminal (Ctrl+Shift+`)" size="sm" @click="newTerminal">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
        </IconButton>
      </div>
    </header>
    <div ref="hostRef" class="terminal__host" />
  </div>
</template>

<style scoped>
.terminal { position: relative; display: flex; flex-direction: column; background: var(--term-bg); border-top: 1px solid var(--border); flex-shrink: 0; }
.terminal__header { display: flex; align-items: center; justify-content: space-between; height: 32px; flex: 0 0 32px; padding: 0 6px 0 4px; border-bottom: 1px solid var(--border); background: var(--bg-0); }
.terminal__tabs { display: flex; align-items: center; gap: 2px; height: 100%; overflow-x: auto; scrollbar-width: none; }
.terminal__tabs::-webkit-scrollbar { display: none; }
.terminal__tab { display: flex; align-items: center; gap: 6px; padding: 0 4px 0 10px; height: 24px; border-radius: var(--radius-sm); color: var(--fg-muted); font-size: 11px; transition: background 100ms, color 100ms; min-width: 90px; max-width: 200px; position: relative; }
.terminal__tab:hover { background: var(--bg-2); color: var(--fg); }
.terminal__tab--active { background: var(--bg-3); color: var(--fg); }
.terminal__tab--dead .terminal__tab-label { text-decoration: line-through; opacity: 0.6; }
.terminal__tab-label { flex: 1; min-width: 0; }
.terminal__tab-close { display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 3px; color: var(--fg-subtle); }
.terminal__tab-close:hover { background: var(--bg-3); color: var(--fg); }
.terminal__actions { display: flex; align-items: center; gap: 4px; }
.terminal__search input { width: 140px; padding: 3px 8px; font-size: 11px; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--fg); }
.terminal__search input:focus { outline: none; border-color: var(--accent); }
.terminal__host { flex: 1; min-height: 0; overflow: hidden; position: relative; padding: 4px 8px; }
.terminal__host :deep(.terminal-instance) { width: 100%; height: 100%; }
.terminal__host :deep(.xterm) { height: 100%; padding: 0; }
.terminal__host :deep(.xterm-viewport) { background: var(--term-bg) !important; }
</style>