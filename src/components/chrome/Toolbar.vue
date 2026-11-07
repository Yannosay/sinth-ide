<script setup lang="ts">
import { computed, watch } from 'vue'
import { open as openUrl } from '@tauri-apps/plugin-shell'
import { useWorkspaceStore } from '@/stores/workspace'
import { useProjectStore, type ProjectAction } from '@/stores/project'
import IconButton from '@/components/ui/IconButton.vue'

const workspace = useWorkspaceStore()
const project = useProjectStore()

const compilerNote = computed(() => {
  const c = project.compiler
  if (!project.isSinth || !c) return null
  if (!c.node) return null
  if (!c.entry) return 'Uses the latest Sinth from npm (no compiler installed)'
  const where = c.source === 'project' ? 'project' : c.source === 'managed' ? 'IDE' : 'global'
  return `Sinth ${c.version ?? ''} (${where})`.replace('  ', ' ')
})

function run(action: ProjectAction): void {
  window.dispatchEvent(new CustomEvent('sinth:terminal-run', { detail: { command: project.commandLine(action), title: action.label } }))
}

function stop(): void {
  window.dispatchEvent(new CustomEvent('sinth:terminal-interrupt'))
}

function clear(): void {
  window.dispatchEvent(new CustomEvent('sinth:terminal-clear'))
}

watch(() => workspace.rootPath, () => { void project.detect() }, { immediate: true })
</script>

<template>
  <div class="toolbar">
    <div class="toolbar__left" :title="workspace.rootPath ?? 'No folder opened'">
      <span class="toolbar__project truncate">{{ workspace.rootName ?? 'No folder open' }}</span>
    </div>

    <div class="toolbar__center">
      <template v-if="project.nodeMissing">
        <span class="toolbar__note">Node.js 18 or newer is required to run Sinth.</span>
        <button class="toolbar__link" type="button" @click="openUrl('https://nodejs.org/en/download')">Download Node.js</button>
        <button class="toolbar__link" type="button" @click="project.detect()">Retry</button>
      </template>
      <template v-else>
        <button
          v-for="action in project.actions"
          :key="action.id"
          type="button"
          class="toolbar__action"
          :class="{ 'toolbar__action--primary': action.kind === 'run' }"
          :title="project.commandLine(action)"
          @click="run(action)"
        >
          <svg v-if="action.kind === 'run'" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z" /></svg>
          <svg v-else-if="action.kind === 'build'" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>
          <svg v-else-if="action.kind === 'preview'" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          <svg v-else-if="action.kind === 'check' || action.kind === 'test'" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          <svg v-else-if="action.kind === 'deploy'" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          <svg v-else viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14" /></svg>
          <span>{{ action.label }}</span>
        </button>
        <span v-if="workspace.rootPath && !project.detecting && project.actions.length === 0" class="toolbar__note">
          Add a .sinth file to run this folder with Sinth
        </span>
      </template>
    </div>

    <div class="toolbar__right">
      <span v-if="compilerNote" class="toolbar__compiler" :title="project.compiler?.entry ?? ''">{{ compilerNote }}</span>
      <IconButton title="Stop the running command (Ctrl+C in the terminal)" size="sm" @click="stop">
        <svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5" /></svg>
      </IconButton>
      <IconButton title="Clear terminal" size="sm" @click="clear">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="m6.5 17.5 11-11" /></svg>
      </IconButton>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 12px; height: 36px; flex: 0 0 36px; padding: 0 8px 0 12px; background: var(--bg-1); border-bottom: 1px solid var(--border); user-select: none; }
.toolbar__left { display: flex; align-items: center; min-width: 120px; max-width: 240px; }
.toolbar__project { font-size: 12px; font-weight: 500; color: var(--fg); }
.toolbar__center { flex: 1; display: flex; align-items: center; gap: 2px; overflow-x: auto; scrollbar-width: none; min-width: 0; }
.toolbar__center::-webkit-scrollbar { display: none; }
.toolbar__action { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: var(--radius-sm); font-size: 12px; color: var(--fg-muted); flex-shrink: 0; }
.toolbar__action:hover { background: var(--bg-3); color: var(--fg); }
.toolbar__action--primary { color: var(--fg); }
.toolbar__action--primary svg { color: var(--success); }
.toolbar__note { font-size: 12px; color: var(--fg-subtle); padding: 0 8px; white-space: nowrap; }
.toolbar__link { font-size: 12px; color: var(--accent); padding: 0 6px; height: 24px; border-radius: var(--radius-sm); white-space: nowrap; }
.toolbar__link:hover { background: var(--bg-3); }
.toolbar__right { display: flex; align-items: center; gap: 2px; }
.toolbar__compiler { font-size: 11px; color: var(--fg-subtle); margin-right: 6px; white-space: nowrap; }
</style>
