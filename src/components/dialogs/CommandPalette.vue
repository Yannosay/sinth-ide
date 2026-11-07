<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '@/stores/workspace'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useUpdaterStore } from '@/stores/updater'
import { useCompilersStore } from '@/stores/compilers'

interface Command {
  id: string
  label: string
  category: string
  hint?: string
  run: () => void | Promise<void>
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const inputRef = ref<HTMLInputElement | null>(null)
const query = ref('')
const selectedIndex = ref(0)

const workspace = useWorkspaceStore()
const editor = useEditorStore()
const settings = useSettingsStore()
const updater = useUpdaterStore()
const compilers = useCompilersStore()

async function openFolder(): Promise<void> {
  const picked = await openDialog({ directory: true, multiple: false })
  if (typeof picked !== 'string') return
  await workspace.openFolder(picked)
  settings.pushRecentFolder(picked)
}

async function openFile(): Promise<void> {
  const picked = await openDialog({ multiple: false })
  if (typeof picked !== 'string') return
  const content = await invoke<string>('read_text_file', { path: picked })
  editor.openFile(picked, content)
  settings.pushRecentFile(picked)
}

const commands = computed<Command[]>(() => [
  { id: 'folder.open', label: 'Open Folder', category: 'File', hint: 'Ctrl+Shift+O', run: openFolder },
  { id: 'file.open', label: 'Open File', category: 'File', run: openFile },
  { id: 'file.closeTab', label: 'Close Tab', category: 'File', hint: 'Ctrl+W', run: () => { if (editor.activeTabId) editor.closeTab(editor.activeTabId) } },
  { id: 'file.closeAll', label: 'Close All Tabs', category: 'File', run: () => editor.closeAll() },
  { id: 'view.terminal', label: 'Toggle Terminal', category: 'View', hint: 'Ctrl+`', run: () => window.dispatchEvent(new CustomEvent('sinth:toggle-terminal')) },
  { id: 'view.newTerminal', label: 'New Terminal', category: 'View', run: () => window.dispatchEvent(new CustomEvent('sinth:new-terminal')) },
  { id: 'view.sidebar', label: 'Toggle Activity Bar', category: 'View', run: () => { settings.activityBarVisible = !settings.activityBarVisible } },
  { id: 'view.statusBar', label: 'Toggle Status Bar', category: 'View', run: () => { settings.statusBarVisible = !settings.statusBarVisible } },
  { id: 'update.check', label: 'Check for Updates', category: 'Updates', run: () => updater.checkForUpdate() },
  { id: 'compilers.refresh', label: 'Refresh Compiler Registry', category: 'Compilers', run: () => compilers.refreshAvailable(true) },
  { id: 'settings.reset', label: 'Reset All Settings', category: 'Settings', run: () => settings.reset() }
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return commands.value
  return commands.value.filter(c =>
    c.label.toLowerCase().includes(q) ||
    c.category.toLowerCase().includes(q) ||
    (c.hint ?? '').toLowerCase().includes(q)
  )
})

watch(() => props.open, async v => {
  if (v) {
    query.value = ''
    selectedIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

watch(filtered, () => { selectedIndex.value = 0 })

function close(): void { emit('update:open', false) }

async function runCommand(c: Command): Promise<void> {
  close()
  try { await c.run() } catch (err) { console.error('[palette]', err) }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') { e.preventDefault(); close(); return }
  if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex.value = Math.min(filtered.value.length - 1, selectedIndex.value + 1); return }
  if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex.value = Math.max(0, selectedIndex.value - 1); return }
  if (e.key === 'Enter') {
    e.preventDefault()
    const c = filtered.value[selectedIndex.value]
    if (c) void runCommand(c)
  }
}
</script>

<template>
  <Transition name="palette">
    <div v-if="open" class="palette" @mousedown="e => { if (e.target === e.currentTarget) close() }">
      <div class="palette__dialog" @keydown="onKeyDown">
        <div class="palette__input-wrap">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21 21-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
          </svg>
          <input ref="inputRef" v-model="query" type="text" placeholder="Type a command" class="palette__input">
          <kbd>Esc</kbd>
        </div>
        <ul v-if="filtered.length" class="palette__list">
          <li
            v-for="(c, i) in filtered"
            :key="c.id"
            class="palette__item"
            :class="{ 'palette__item--selected': i === selectedIndex }"
            @mouseenter="selectedIndex = i"
            @click="runCommand(c)"
          >
            <span class="palette__category">{{ c.category }}</span>
            <span class="palette__label">{{ c.label }}</span>
            <kbd v-if="c.hint" class="palette__kbd">{{ c.hint }}</kbd>
          </li>
        </ul>
        <div v-else class="palette__empty">No commands match "{{ query }}"</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.palette { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; justify-content: center; padding-top: 12vh; z-index: 1100; }
.palette__dialog { width: 640px; max-width: calc(100vw - 48px); background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden; display: flex; flex-direction: column; max-height: 60vh; }
.palette__input-wrap { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); color: var(--fg-muted); }
.palette__input { flex: 1; background: transparent; border: none; outline: none; color: var(--fg); font: inherit; font-size: 14px; }
.palette__input-wrap kbd { font-family: var(--font-mono); font-size: 10px; color: var(--fg-subtle); background: var(--bg-3); padding: 2px 6px; border-radius: 3px; }
.palette__list { list-style: none; margin: 0; padding: 4px; overflow-y: auto; }
.palette__item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; }
.palette__item--selected { background: var(--accent-soft); }
.palette__category { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-subtle); min-width: 76px; }
.palette__label { flex: 1; }
.palette__kbd { font-family: var(--font-mono); font-size: 10px; color: var(--fg-subtle); background: var(--bg-3); padding: 2px 6px; border-radius: 3px; }
.palette__empty { padding: 24px; text-align: center; color: var(--fg-muted); font-size: 12px; }
.palette-enter-active, .palette-leave-active { transition: opacity 120ms; }
.palette-enter-from, .palette-leave-to { opacity: 0; }
</style>