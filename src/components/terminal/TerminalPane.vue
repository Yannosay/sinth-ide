<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '@/stores/terminal'
import { useSettingsStore } from '@/stores/settings'
import { useWorkspaceStore } from '@/stores/workspace'
import IconButton from '@/components/ui/IconButton.vue'

const height = defineModel<number>('height', { required: true })

const store = useTerminalStore()
const settings = useSettingsStore()
const workspace = useWorkspaceStore()

interface Runtime {
  id: number
  term: Terminal
  fit: FitAddon
  search: SearchAddon
  container: HTMLDivElement
  unlisten: UnlistenFn | null
  cwd: string
  userInteracted: boolean
}

const runtimes = ref<Runtime[]>([])
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

async function spawnTerminal(cwdOverride?: string): Promise<number | null> {
  if (!hostRef.value) return null

  const cwd = cwdOverride ?? workspace.rootPath ?? ''
  const cols = 120
  const rows = 30
  const shell = settings.terminalShell || undefined

  let id: number
  try {
    id = await invoke<number>('spawn_terminal', { cwd, shell, cols, rows })
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
      background: '#0b0b0e',
      foreground: '#d4d4d8',
      cursor: '#a855f7',
      selectionBackground: 'rgba(168, 85, 247, 0.28)',
      black: '#0b0b0e', red: '#ef4444', green: '#22c55e', yellow: '#f59e0b',
      blue: '#3b82f6', magenta: '#a855f7', cyan: '#06b6d4', white: '#e6e6ee',
      brightBlack: '#6b6b78', brightRed: '#f87171', brightGreen: '#4ade80', brightYellow: '#fbbf24',
      brightBlue: '#60a5fa', brightMagenta: '#c084fc', brightCyan: '#22d3ee', brightWhite: '#ffffff'
    }
  })

  const fit = new FitAddon()
  const search = new SearchAddon()
  term.loadAddon(fit)
  term.loadAddon(search)
  term.loadAddon(new WebLinksAddon())

  term.open(container)
  await nextTick()
  fit.fit()

  term.onData(data => {
    const rt = runtimes.value.find(r => r.id === id)
    if (rt) rt.userInteracted = true
    void invoke('write_terminal', { id, data })
  })

  term.onResize(({ cols: c, rows: r }) => { void invoke('resize_terminal', { id, cols: c, rows: r }) })

  const unlisten = await listen<{ data: string }>(`terminal-output:${id}`, ev => { term.write(ev.payload.data) })
  const unlistenExit = await listen(`terminal-exit:${id}`, () => {
    store.markDead(id)
    term.write('\r\n\x1b[2m[process exited]\x1b[0m\r\n')
  })

  const combined: UnlistenFn = () => { unlisten(); unlistenExit() }
  runtimes.value.push({ id, term, fit, search, container, unlisten: combined, cwd, userInteracted: false })

  const title = cwd ? `Shell — ${cwd.split(/[\\/]/).pop() || cwd}` : `Shell ${store.instances.length + 1}`
  store.register({ id, title, cwd, alive: true })
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
  await closeTerminal(id)
  await spawnTerminal(cwd)
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

async function ensureTerminal(): Promise<number | null> {
  if (runtimes.value.length > 0 && store.activeId !== null) return store.activeId
  return await spawnTerminal(workspace.rootPath ?? undefined)
}

async function runCommandInActive(command: string): Promise<void> {
  const id = await ensureTerminal()
  if (id === null) return
  const rt = runtimes.value.find(r => r.id === id)
  if (rt) rt.userInteracted = true
  await invoke('write_terminal', { id, data: command + '\r' })
  setActive(id)
}

async function interruptActive(): Promise<void> {
  const id = store.activeId
  if (id === null) return
  await invoke('write_terminal', { id, data: '\x03' })
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

onMounted(async () => {
  window.addEventListener('resize', onResize)
  window.addEventListener('sinth:new-terminal', onNewTerminalEvent)
  window.addEventListener('sinth:terminal-run', onRunEvent)
  window.addEventListener('sinth:terminal-interrupt', onInterruptEvent)
  window.addEventListener('sinth:terminal-clear', onClearEvent)

  await spawnTerminal(workspace.rootPath ?? undefined)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('sinth:new-terminal', onNewTerminalEvent)
  window.removeEventListener('sinth:terminal-run', onRunEvent)
  window.removeEventListener('sinth:terminal-interrupt', onInterruptEvent)
  window.removeEventListener('sinth:terminal-clear', onClearEvent)
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
          <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
        </IconButton>
        <IconButton title="Find" size="sm" @click="searchVisible = !searchVisible">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
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
.terminal__header { display: flex; align-items: center; justify-content: space-between; height: 30px; flex: 0 0 30px; padding: 0 6px 0 0; border-bottom: 1px solid var(--border); background: var(--bg-1); }
.terminal__tabs { display: flex; height: 100%; overflow-x: auto; scrollbar-width: none; }
.terminal__tabs::-webkit-scrollbar { display: none; }
.terminal__tab { display: flex; align-items: center; gap: 6px; padding: 0 8px 0 12px; height: 100%; border-right: 1px solid var(--border); color: var(--fg-muted); font-size: 11px; transition: background 60ms, color 60ms; min-width: 100px; max-width: 220px; position: relative; }
.terminal__tab:hover { background: var(--bg-2); color: var(--fg); }
.terminal__tab--active { background: var(--term-bg); color: var(--fg); }
.terminal__tab--active::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: var(--accent); }
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