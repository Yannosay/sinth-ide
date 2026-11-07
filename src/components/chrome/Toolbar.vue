<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '@/stores/workspace'
import IconButton from '@/components/ui/IconButton.vue'

interface ProjectAction {
  id: string
  label: string
  command: string
  kind: 'run' | 'build' | 'test' | 'clean' | 'custom'
}

const workspace = useWorkspaceStore()

const detectedKind = ref<string>('unknown')
const actions = ref<ProjectAction[]>([])
const loading = ref(false)

function joinPath(base: string, name: string): string {
  const sep = base.includes('\\') ? '\\' : '/'
  return base.replace(/[\\/]+$/, '') + sep + name
}

async function tryReadText(path: string): Promise<string | null> {
  try {
    const content = await invoke<string>('read_text_file', { path })
    return content
  } catch {
    return null
  }
}

async function detectProject(): Promise<void> {
  actions.value = []
  detectedKind.value = 'unknown'

  const root = workspace.rootPath
  if (!root) return

  loading.value = true
  try {
    const pkgRaw = await tryReadText(joinPath(root, 'package.json'))
    const sinthConfig = await tryReadText(joinPath(root, 'sinth.config.json'))
    let pkg: { scripts?: Record<string, string>; packageManager?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null = null
    if (pkgRaw) {
      try {
        pkg = JSON.parse(pkgRaw)
      } catch (err) {
        console.warn('[toolbar] package.json parse failed:', err)
      }
    }
    const usesSinth = sinthConfig !== null || !!pkg?.dependencies?.['@yannosay/sinth'] || !!pkg?.devDependencies?.['@yannosay/sinth']
    if (pkg) {
      const scripts = pkg.scripts ?? {}
      let pm = (pkg.packageManager ?? '').split('@')[0]
      if (!pm) {
        if (await tryReadText(joinPath(root, 'pnpm-lock.yaml')) !== null) pm = 'pnpm'
        else if (await tryReadText(joinPath(root, 'yarn.lock')) !== null) pm = 'yarn'
        else pm = 'npm'
      }
      const run = (script: string): string => (pm === 'npm' ? `npm run ${script}` : `${pm} ${script}`)
      detectedKind.value = usesSinth ? 'Sinth' : 'Node'
      const order: Array<{ key: string; label: string; kind: ProjectAction['kind'] }> = [
        { key: 'dev', label: 'Run dev', kind: 'run' },
        { key: 'build', label: 'Build', kind: 'build' },
        { key: 'preview', label: 'Preview', kind: 'custom' },
        { key: 'check', label: 'Check', kind: 'test' },
        { key: 'test', label: 'Test', kind: 'test' },
        { key: 'deploy', label: 'Deploy', kind: 'custom' }
      ]
      for (const entry of order) {
        if (scripts[entry.key]) actions.value.push({ id: entry.key, label: entry.label, command: run(entry.key), kind: entry.kind })
      }
      if (actions.value.length) return
    }
    if (usesSinth || await tryReadText(joinPath(root, joinPath('pages', 'index.sinth'))) !== null) {
      detectedKind.value = 'Sinth'
      actions.value.push(
        { id: 'run', label: 'Run dev', command: 'sinth dev', kind: 'run' },
        { id: 'build', label: 'Build', command: 'sinth build', kind: 'build' },
        { id: 'preview', label: 'Preview', command: 'sinth preview', kind: 'custom' },
        { id: 'check', label: 'Check', command: 'sinth check', kind: 'test' },
        { id: 'deploy', label: 'Deploy', command: 'sinth deploy', kind: 'custom' }
      )
      return
    }

    const cargoRaw = await tryReadText(joinPath(root, 'Cargo.toml'))
    if (cargoRaw) {
      detectedKind.value = 'Rust'
      actions.value.push(
        { id: 'run', label: 'Run', command: 'cargo run', kind: 'run' },
        { id: 'build', label: 'Build', command: 'cargo build', kind: 'build' },
        { id: 'test', label: 'Test', command: 'cargo test', kind: 'test' },
        { id: 'clean', label: 'Clean', command: 'cargo clean', kind: 'clean' }
      )
      return
    }

    const pyproject = await tryReadText(joinPath(root, 'pyproject.toml'))
    const requirements = await tryReadText(joinPath(root, 'requirements.txt'))
    if (pyproject || requirements) {
      detectedKind.value = 'Python'
      actions.value.push(
        { id: 'run', label: 'Run', command: 'python main.py', kind: 'run' },
        { id: 'test', label: 'Test', command: 'python -m pytest', kind: 'test' }
      )
      return
    }

    const goMod = await tryReadText(joinPath(root, 'go.mod'))
    if (goMod) {
      detectedKind.value = 'Go'
      actions.value.push(
        { id: 'run', label: 'Run', command: 'go run .', kind: 'run' },
        { id: 'build', label: 'Build', command: 'go build ./...', kind: 'build' },
        { id: 'test', label: 'Test', command: 'go test ./...', kind: 'test' }
      )
      return
    }

    detectedKind.value = 'Unknown'
  } finally {
    loading.value = false
  }
}

function runAction(action: ProjectAction): void {
  const root = workspace.rootPath
  const changeDir = root
    ? (root.includes('\\') ? `Set-Location -LiteralPath "${root}"` : `cd "${root}"`)
    : null
  const command = changeDir ? `${changeDir}; ${action.command}` : action.command
  window.dispatchEvent(new CustomEvent('sinth:terminal-run', { detail: { command } }))
}

function stopAll(): void {
  window.dispatchEvent(new CustomEvent('sinth:terminal-interrupt'))
}

function clearTerminal(): void {
  window.dispatchEvent(new CustomEvent('sinth:terminal-clear'))
}

watch(() => workspace.rootPath, () => { void detectProject() }, { immediate: true })
</script>

<template>
  <div class="toolbar">
    <div class="toolbar__left">
      <span class="toolbar__project" :title="workspace.rootPath ?? 'No folder opened'">
        <span class="toolbar__project-dot" :class="{ 'toolbar__project-dot--active': !!workspace.rootPath }" />
        <span class="truncate">{{ workspace.rootName ?? 'No folder' }}</span>
        <span v-if="detectedKind !== 'unknown'" class="toolbar__kind">{{ detectedKind }}</span>
      </span>
    </div>

    <div class="toolbar__center">
      <button
        v-for="action in actions"
        :key="action.id"
        type="button"
        class="toolbar__action"
        :class="`toolbar__action--${action.kind}`"
        :title="action.command"
        :disabled="!workspace.rootPath"
        @click="runAction(action)"
      >
        <svg v-if="action.kind === 'run'" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        <svg v-else-if="action.kind === 'build'" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
        <svg v-else-if="action.kind === 'test'" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></svg>
        <svg v-else-if="action.kind === 'clean'" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
        <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /></svg>
        <span>{{ action.label }}</span>
      </button>

      <span v-if="actions.length === 0 && workspace.rootPath" class="toolbar__empty">
        No runnable project detected
      </span>
    </div>

    <div class="toolbar__right">
      <IconButton title="Interrupt terminal (Ctrl+C)" size="sm" :disabled="!workspace.rootPath" @click="stopAll">
        <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
      </IconButton>
      <IconButton title="Clear terminal" size="sm" @click="clearTerminal">
        <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
      </IconButton>
      <IconButton title="Reload project detection" size="sm" :disabled="!workspace.rootPath || loading" @click="detectProject">
        <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
      </IconButton>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 38px;
  flex: 0 0 38px;
  padding: 0 10px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  user-select: none;
}

.toolbar__left {
  display: flex;
  align-items: center;
  min-width: 180px;
  max-width: 260px;
}

.toolbar__project {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--fg-muted);
  min-width: 0;
}

.toolbar__project-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fg-subtle);
  flex-shrink: 0;
}

.toolbar__project-dot--active {
  background: var(--success);
}

.toolbar__kind {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
}

.toolbar__center {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.toolbar__center::-webkit-scrollbar {
  display: none;
}

.toolbar__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--fg);
  background: transparent;
  transition: background 100ms, border-color 100ms;
  flex-shrink: 0;
}

.toolbar__action:hover:not(:disabled) {
  background: var(--bg-3);
}

.toolbar__action:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.toolbar__action--run {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.25);
}

.toolbar__action--run:hover:not(:disabled) {
  background: rgba(74, 222, 128, 0.10);
}

.toolbar__action--build {
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.25);
}

.toolbar__action--build:hover:not(:disabled) {
  background: rgba(96, 165, 250, 0.10);
}

.toolbar__action--test {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.25);
}

.toolbar__action--test:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.10);
}

.toolbar__empty {
  font-size: 12px;
  color: var(--fg-subtle);
  padding: 0 8px;
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 2px;
}
</style>