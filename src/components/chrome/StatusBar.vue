<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '@/stores/editor'
import { useCompilersStore } from '@/stores/compilers'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUpdaterStore } from '@/stores/updater'
import { useDiagnosticsStore, type SinthDiagnostic } from '@/stores/diagnostics'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{ terminalVisible: boolean }>()
const emit = defineEmits<{ (e: 'toggle-terminal'): void }>()

const editor = useEditorStore()
const compilers = useCompilersStore()
const workspace = useWorkspaceStore()
const updater = useUpdaterStore()
const diagnostics = useDiagnosticsStore()
const project = useProjectStore()
const settings = useSettingsStore()

const problemsOpen = ref(false)

function onDocumentPointer(e: PointerEvent): void {
  if (!(e.target as Element | null)?.closest('.status__problems-wrap')) problemsOpen.value = false
}
function onDocumentKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') problemsOpen.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointer)
  document.addEventListener('keydown', onDocumentKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onDocumentKey)
})
const installing = ref(false)
const installError = ref<string | null>(null)

const LANGUAGE_NAMES: Record<string, string> = {
  sinth: 'Sinth', typescript: 'TypeScript', javascript: 'JavaScript', json: 'JSON', css: 'CSS', scss: 'SCSS',
  html: 'HTML', markdown: 'Markdown', rust: 'Rust', toml: 'TOML', yaml: 'YAML', plaintext: 'Plain Text', xml: 'XML', python: 'Python',
}

const compilerLabel = computed(() => {
  const c = project.compiler
  if (!c) return null
  if (!c.node) return 'Node.js not found'
  if (!c.entry) return 'Sinth not installed'
  return `Sinth ${c.version ?? ''}`.trim()
})
const needsCompiler = computed(() => project.isSinth && !!project.compiler?.node && !project.compiler.entry)
const languageLabel = computed(() => LANGUAGE_NAMES[editor.activeTab?.language ?? 'plaintext'] ?? editor.activeTab?.language ?? '')
const lineEnding = computed(() => editor.activeTab?.lineEnding?.toUpperCase() ?? null)
const updateBadge = computed(() => updater.state === 'available' ? updater.availableVersion : null)

async function installSinth(): Promise<void> {
  installing.value = true
  installError.value = null
  try {
    await compilers.installLatest()
    await project.refreshCompiler()
    if (workspace.rootPath) void diagnostics.check(workspace.rootPath)
  } catch (err) {
    installError.value = String(err)
  } finally {
    installing.value = false
  }
}

function relative(file: string): string {
  const root = workspace.rootPath
  if (!root) return file
  const norm = (p: string): string => p.replace(/\\/g, '/')
  const r = norm(root).replace(/\/$/, '') + '/'
  return norm(file).toLowerCase().startsWith(r.toLowerCase()) ? norm(file).slice(r.length) : norm(file)
}

async function openProblem(d: SinthDiagnostic): Promise<void> {
  problemsOpen.value = false
  if (!d.loc) return
  try {
    const content = await invoke<string>('read_text_file', { path: d.loc.file })
    editor.openFile(d.loc.file, content)
    settings.pushRecentFile(d.loc.file)
    window.dispatchEvent(new CustomEvent('sinth:reveal', { detail: { line: d.loc.line, column: d.loc.col } }))
  } catch (err) {
    console.error('[problems]', err)
  }
}
</script>

<template>
  <footer class="status">
    <div class="status__left">
      <span v-if="workspace.rootPath && project.isSinth" class="status__problems-wrap">
        <button class="status__item" type="button" title="Problems found by sinth check (runs on save)" @click="problemsOpen = !problemsOpen">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
          <span :class="{ 'status__count--error': diagnostics.errorCount > 0 }">{{ diagnostics.errorCount }}</span>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20zM12 10v4M12 17h.01" /></svg>
          <span :class="{ 'status__count--warn': diagnostics.warningCount > 0 }">{{ diagnostics.warningCount }}</span>
          <span v-if="diagnostics.running" class="status__muted">checking</span>
        </button>
        <div v-if="problemsOpen" class="problems">
          <div class="problems__head">
            <span>Problems</span>
            <button class="status__item" type="button" title="Run sinth check again" @click="workspace.rootPath && diagnostics.check(workspace.rootPath)">Recheck</button>
          </div>
          <div v-if="diagnostics.items.length === 0" class="problems__empty">No problems found.</div>
          <button v-for="(d, i) in diagnostics.items" :key="i" class="problems__row" type="button" @click="openProblem(d)">
            <span class="problems__sev" :class="d.severity === 'error' ? 'problems__sev--error' : 'problems__sev--warn'" />
            <span class="problems__msg">{{ d.message }}<span v-if="d.hint" class="problems__hint">{{ d.hint }}</span></span>
            <span class="problems__loc">{{ d.loc ? `${relative(d.loc.file)}:${d.loc.line}` : d.code }}</span>
          </button>
        </div>
      </span>
      <template v-if="project.isSinth && compilerLabel">
        <button v-if="needsCompiler" class="status__item status__item--accent" type="button" :disabled="installing" :title="installError ?? 'Download the latest Sinth compiler from npm'" @click="installSinth">
          {{ installing ? 'Installing Sinth...' : installError ? 'Sinth install failed, retry' : 'Install Sinth' }}
        </button>
        <span v-else class="status__item status__item--static" :title="project.compiler?.entry ?? 'Install Node.js 18 or newer from nodejs.org'">{{ compilerLabel }}</span>
      </template>
    </div>
    <div class="status__right">
      <button v-if="updateBadge" class="status__item status__item--accent" type="button" title="An update is available" @click="updater.reopen()">
        Update to {{ updateBadge }}
      </button>
      <template v-if="editor.activeTab">
        <span class="status__item status__item--static">Ln {{ editor.cursorLine }}, Col {{ editor.cursorColumn }}</span>
        <span class="status__item status__item--static">UTF-8</span>
        <span v-if="lineEnding" class="status__item status__item--static">{{ lineEnding }}</span>
        <span class="status__item status__item--static">{{ languageLabel }}</span>
      </template>
      <button class="status__item" type="button" :title="props.terminalVisible ? 'Hide terminal (Ctrl+`)' : 'Show terminal (Ctrl+`)'" @click="emit('toggle-terminal')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="m7 9 3 3-3 3M12 15h5" />
          <rect x="3" y="4" width="18" height="16" rx="2" />
        </svg>
      </button>
    </div>
  </footer>
</template>

<style scoped>
.status { position: relative; display: flex; align-items: center; justify-content: space-between; height: 24px; flex: 0 0 24px; background: var(--bg-1); border-top: 1px solid var(--border); font-size: 11px; color: var(--fg-muted); padding: 0 6px; user-select: none; }
.status__left, .status__right { display: flex; align-items: center; gap: 2px; min-width: 0; }
.status__item { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 6px; border-radius: var(--radius-sm); white-space: nowrap; }
.status__item:hover:not(.status__item--static):not(:disabled) { background: var(--bg-2); color: var(--fg); }
.status__item--static { cursor: default; }
.status__item--accent { color: var(--accent); }
.status__muted { color: var(--fg-subtle); margin-left: 4px; }
.status__count--error { color: var(--error); }
.status__count--warn { color: var(--warning); }
.status__problems-wrap { position: relative; }
.problems { position: absolute; bottom: 26px; left: 0; width: min(560px, 80vw); max-height: 320px; overflow: auto; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45); z-index: 50; padding: 4px; }
.problems__head { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 6px; font-size: 11px; font-weight: 600; color: var(--fg); }
.problems__empty { padding: 10px 8px; color: var(--fg-subtle); }
.problems__row { display: grid; grid-template-columns: 8px 1fr auto; gap: 8px; align-items: start; width: 100%; padding: 6px 8px; border-radius: var(--radius-sm); text-align: left; font-size: 12px; color: var(--fg); }
.problems__row:hover { background: var(--bg-3); }
.problems__sev { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; }
.problems__sev--error { background: var(--error); }
.problems__sev--warn { background: var(--warning); }
.problems__msg { display: flex; flex-direction: column; gap: 2px; user-select: text; }
.problems__hint { color: var(--fg-muted); font-size: 11px; }
.problems__loc { color: var(--fg-subtle); font-family: var(--font-mono); font-size: 11px; white-space: nowrap; }
</style>
