<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '@/stores/workspace'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useUpdaterStore } from '@/stores/updater'
import { useCompilersStore } from '@/stores/compilers'
import { useProjectStore } from '@/stores/project'
import { usePreviewStore } from '@/stores/preview'
import { platformShortcut } from '@/composables/useShortcutRouter'
import FileIcon from '@/components/ui/FileIcon.vue'

interface Command {
  id: string
  label: string
  category: string
  hint?: string
  run: () => void | Promise<void>
}

interface FileItem { rel: string; name: string; dir: string; score: number }

const props = defineProps<{ open: boolean; prefix?: string }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLUListElement | null>(null)
const query = ref('')
const selectedIndex = ref(0)
const files = ref<string[]>([])
const filesRoot = ref<string | null>(null)

const workspace = useWorkspaceStore()
const editor = useEditorStore()
const settings = useSettingsStore()
const updater = useUpdaterStore()
const compilers = useCompilersStore()
const project = useProjectStore()
const preview = usePreviewStore()

const commandMode = computed(() => query.value.startsWith('>') || !workspace.rootPath)
const term = computed(() => (commandMode.value ? query.value.replace(/^>/, '') : query.value).trim().toLowerCase())

async function openFolder(): Promise<void> {
  const picked = await openDialog({ directory: true, multiple: false })
  if (typeof picked !== 'string') return
  await workspace.openFolder(picked)
  settings.pushRecentFolder(picked)
}

async function openFile(): Promise<void> {
  const picked = await openDialog({ multiple: false })
  if (typeof picked !== 'string') return
  await openPath(picked)
}

async function openPath(path: string): Promise<void> {
  const content = await invoke<string>('read_text_file', { path })
  editor.openFile(path, content)
  settings.pushRecentFile(path)
}

const commands = computed<Command[]>(() => [
  ...project.actions.map(a => ({ id: 'project.' + a.id, label: a.label, category: project.isSinth ? 'Sinth' : 'Project', hint: [a.program, ...a.args].join(' '), run: () => project.runAction(a) })),
  ...(project.isSinth ? [
    { id: 'preview.toggle', label: preview.visible ? 'Hide Preview' : 'Show Preview', category: 'View', hint: platformShortcut('Ctrl+Shift+V'), run: () => preview.toggle() },
    { id: 'sinth.skill', label: 'Install AI Agent Skill', category: 'Sinth', hint: 'sinth skill', run: () => project.runAction(project.skillAction) },
  ] : []),
  { id: 'folder.open', label: 'Open Folder', category: 'File', hint: platformShortcut('Ctrl+Shift+O'), run: openFolder },
  { id: 'file.open', label: 'Open File', category: 'File', run: openFile },
  { id: 'file.closeTab', label: 'Close Tab', category: 'File', hint: platformShortcut('Ctrl+W'), run: () => { if (editor.activeTabId) void editor.requestClose(editor.activeTabId) } },
  { id: 'file.closeAll', label: 'Close All Tabs', category: 'File', run: () => { void editor.requestCloseAll() } },
  { id: 'view.terminal', label: 'Toggle Terminal', category: 'View', hint: platformShortcut('Ctrl+`'), run: () => window.dispatchEvent(new CustomEvent('sinth:toggle-terminal')) },
  { id: 'view.newTerminal', label: 'New Terminal', category: 'View', hint: platformShortcut('Ctrl+Shift+`'), run: () => window.dispatchEvent(new CustomEvent('sinth:new-terminal')) },
  { id: 'view.sidebar', label: 'Toggle Sidebar', category: 'View', hint: platformShortcut('Ctrl+B'), run: () => { settings.activityBarVisible = !settings.activityBarVisible } },
  { id: 'view.statusBar', label: 'Toggle Status Bar', category: 'View', run: () => { settings.statusBarVisible = !settings.statusBarVisible } },
  { id: 'update.check', label: 'Check for Updates', category: 'Help', run: () => updater.checkForUpdate() },
  { id: 'compilers.refresh', label: 'Refresh Compiler Versions', category: 'Sinth', run: () => compilers.refreshAvailable(true) },
  { id: 'settings.reset', label: 'Reset All Settings', category: 'Settings', run: () => settings.reset() }
])

const filteredCommands = computed(() => {
  const q = term.value
  if (!q) return commands.value
  return commands.value.filter(c => `${c.category} ${c.label}`.toLowerCase().includes(q) || c.label.toLowerCase().split(' ').some(w => w.startsWith(q)))
})

/** Subsequence match; consecutive characters and matches in the file name score higher. */
function score(rel: string, q: string): number {
  const hay = rel.toLowerCase()
  const name = hay.slice(hay.lastIndexOf('/') + 1)
  if (name.startsWith(q)) return 1000 - name.length
  if (name.includes(q)) return 800 - name.length
  let pos = -1
  let total = 0
  let streak = 0
  for (const ch of q) {
    const next = hay.indexOf(ch, pos + 1)
    if (next < 0) return -1
    streak = next === pos + 1 ? streak + 1 : 0
    total += 1 + streak * 2
    pos = next
  }
  return total - hay.length / 100
}

const filteredFiles = computed<FileItem[]>(() => {
  const q = term.value.replace(/\\/g, '/')
  const recentRel = new Set(settings.recentFiles.map(p => relative(p)))
  const out: FileItem[] = []
  for (const rel of files.value) {
    const s = q ? score(rel, q) : (recentRel.has(rel) ? 1 : 0)
    if (s < 0) continue
    const cut = rel.lastIndexOf('/')
    out.push({ rel, name: rel.slice(cut + 1), dir: cut > 0 ? rel.slice(0, cut) : '', score: s })
  }
  out.sort((a, b) => b.score - a.score || a.rel.length - b.rel.length)
  return out.slice(0, 60)
})

const count = computed(() => commandMode.value ? filteredCommands.value.length : filteredFiles.value.length)

function relative(path: string): string {
  const root = (workspace.rootPath ?? '').replace(/\\/g, '/').replace(/\/$/, '') + '/'
  const p = path.replace(/\\/g, '/')
  return p.toLowerCase().startsWith(root.toLowerCase()) ? p.slice(root.length) : p
}

async function loadFiles(): Promise<void> {
  const root = workspace.rootPath
  if (!root) { files.value = []; return }
  if (filesRoot.value === root && files.value.length) return
  try {
    files.value = await invoke<string[]>('list_files', { path: root })
    filesRoot.value = root
  } catch (err) {
    console.error('[palette]', err)
    files.value = []
  }
}

// Keys are handled on the window while open, so they work wherever focus is.
function onWindowKey(e: KeyboardEvent): void { onKeyDown(e) }
onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKey, true))

watch(() => props.open, async v => {
  if (!v) { window.removeEventListener('keydown', onWindowKey, true); return }
  window.addEventListener('keydown', onWindowKey, true)
  query.value = props.prefix ?? ''
  selectedIndex.value = 0
  filesRoot.value = null
  void loadFiles()
  await nextTick()
  inputRef.value?.focus()
})

watch(query, () => { selectedIndex.value = 0 })

function close(): void { emit('update:open', false) }

async function runCommand(c: Command): Promise<void> {
  close()
  try { await c.run() } catch (err) { console.error('[palette]', err) }
}

async function pickFile(f: FileItem): Promise<void> {
  close()
  const root = workspace.rootPath
  if (!root) return
  const sep = root.includes('\\') ? '\\' : '/'
  try { await openPath(root.replace(/[\\/]+$/, '') + sep + f.rel.split('/').join(sep)) } catch (err) { console.error('[palette]', err) }
}

function choose(i: number): void {
  if (commandMode.value) { const c = filteredCommands.value[i]; if (c) void runCommand(c) }
  else { const f = filteredFiles.value[i]; if (f) void pickFile(f) }
}

function move(delta: number): void {
  if (!count.value) return
  selectedIndex.value = (selectedIndex.value + delta + count.value) % count.value
  void nextTick(() => listRef.value?.children[selectedIndex.value]?.scrollIntoView({ block: 'nearest' }))
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return }
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return }
  if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return }
  if (e.key === 'Enter') { e.preventDefault(); choose(selectedIndex.value) }
}
</script>

<template>
  <Transition name="palette">
    <div v-if="open" class="palette" @mousedown="e => { if (e.target === e.currentTarget) close() }">
      <div class="palette__dialog" role="dialog" aria-label="Command palette">
        <div class="palette__input-wrap">
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            :placeholder="workspace.rootPath ? 'Search files, or type > for commands' : 'Type a command'"
            class="palette__input"
            spellcheck="false"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          >
        </div>
        <ul v-if="count" id="palette-list" ref="listRef" class="palette__list" role="listbox">
          <template v-if="commandMode">
            <li
              v-for="(c, i) in filteredCommands"
              :key="c.id"
              class="palette__item"
              role="option"
              :aria-selected="i === selectedIndex"
              :class="{ 'palette__item--selected': i === selectedIndex }"
              @mousemove="selectedIndex = i"
              @click="choose(i)"
            >
              <span class="palette__label"><span class="palette__category">{{ c.category }}:</span> {{ c.label }}</span>
              <span v-if="c.hint" class="palette__hint">{{ c.hint }}</span>
            </li>
          </template>
          <template v-else>
            <li
              v-for="(f, i) in filteredFiles"
              :key="f.rel"
              class="palette__item"
              role="option"
              :aria-selected="i === selectedIndex"
              :class="{ 'palette__item--selected': i === selectedIndex }"
              @mousemove="selectedIndex = i"
              @click="choose(i)"
            >
              <FileIcon :name="f.name" />
              <span class="palette__label">{{ f.name }}</span>
              <span class="palette__dir truncate">{{ f.dir }}</span>
            </li>
          </template>
        </ul>
        <div v-else class="palette__empty">{{ commandMode ? 'No matching commands' : files.length ? 'No matching files' : 'Loading files' }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.palette { position: fixed; inset: 0; background: rgba(5, 5, 6, 0.5); display: flex; justify-content: center; padding-top: 10vh; z-index: 1100; }
.palette__dialog { width: 620px; max-width: calc(100vw - 48px); background: var(--bg-elevated); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden; display: flex; flex-direction: column; max-height: 62vh; align-self: flex-start; }
.palette__input-wrap { display: flex; align-items: center; padding: 6px; border-bottom: 1px solid var(--border); }
.palette__input { flex: 1; height: 34px; padding: 0 12px; background: var(--bg-0); border: 1px solid var(--border); border-radius: var(--radius-sm); outline: none; color: var(--fg); font: inherit; font-size: 12.5px; }
.palette__input:focus { border-color: var(--accent); }
.palette__list { list-style: none; margin: 0; padding: 4px; overflow-y: auto; }
.palette__item { display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; color: var(--fg); }
.palette__item--selected { background: var(--accent-soft); }
.palette__category { color: var(--fg-muted); }
.palette__label { white-space: nowrap; }
.palette__dir { flex: 1; min-width: 0; font-size: 11px; color: var(--fg-subtle); }
.palette__hint { margin-left: auto; font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-subtle); white-space: nowrap; }
.palette__empty { padding: 22px; text-align: center; color: var(--fg-muted); font-size: 11.5px; }
.palette-enter-active, .palette-leave-active { transition: opacity 120ms var(--ease); }
.palette-enter-from, .palette-leave-to { opacity: 0; }
</style>
