<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useCompilersStore } from '@/stores/compilers'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUpdaterStore } from '@/stores/updater'
import { useDiagnosticsStore } from '@/stores/diagnostics'

const props = defineProps<{ terminalVisible: boolean }>()
const emit = defineEmits<{ (e: 'toggle-terminal'): void }>()

const editor = useEditorStore()
const compilers = useCompilersStore()
const workspace = useWorkspaceStore()
const updater = useUpdaterStore()
const diagnostics = useDiagnosticsStore()

const compilerLabel = computed(() => compilers.activeVersion ? `Sinth ${compilers.activeVersion}` : 'No compiler')
const languageLabel = computed(() => editor.activeTab?.language ?? 'plaintext')
const updateBadge = computed(() => updater.state === 'available' ? updater.availableVersion : null)
</script>

<template>
  <footer class="status">
    <div class="status__left">
      <button class="status__item" type="button" :title="workspace.rootPath ?? 'No folder opened'">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
        <span>{{ workspace.rootName ?? 'No folder' }}</span>
      </button>
      <button class="status__item" type="button" title="Active compiler version">
        <span class="status__dot" :class="{ 'status__dot--active': !!compilers.activeVersion }" />
        <span>{{ compilerLabel }}</span>
      </button>
      <span class="status__item status__item--static">Node {{ compilers.nodeVersion ?? 'not found' }}</span>
      <span v-if="workspace.rootPath" class="status__item status__item--static" :title="diagnostics.lastError ?? 'Sinth diagnostics (updated on save)'">
        <span :class="{ 'status__count--error': diagnostics.errorCount > 0 }">{{ diagnostics.errorCount }} errors</span>
        <span :class="{ 'status__count--warn': diagnostics.warningCount > 0 }">{{ diagnostics.warningCount }} warnings</span>
      </span>
    </div>
    <div class="status__right">
      <button v-if="updateBadge" class="status__item status__item--accent" type="button" title="Update available" @click="updater.reopen()">
        Update {{ updateBadge }}
      </button>
      <span class="status__item status__item--static">Ln {{ editor.cursorLine }}, Col {{ editor.cursorColumn }}</span>
      <span class="status__item status__item--static">{{ languageLabel }}</span>
      <span class="status__item status__item--static">UTF-8</span>
      <button class="status__item" type="button" :title="props.terminalVisible ? 'Hide terminal' : 'Show terminal'" @click="emit('toggle-terminal')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="m7 9 3 3-3 3M12 15h5" />
          <rect x="3" y="4" width="18" height="16" rx="2" />
        </svg>
        <span>Terminal</span>
      </button>
    </div>
  </footer>
</template>

<style scoped>
.status { display: flex; align-items: center; justify-content: space-between; height: 24px; flex: 0 0 24px; background: var(--bg-1); border-top: 1px solid var(--border); font-size: 11px; color: var(--fg-muted); padding: 0 8px; user-select: none; }
.status__left, .status__right { display: flex; align-items: center; gap: 2px; }
.status__item { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 6px; border-radius: var(--radius-sm); transition: background 80ms, color 80ms; }
.status__item:hover:not(.status__item--static) { background: var(--bg-2); color: var(--fg); }
.status__item--static { cursor: default; }
.status__item--accent { color: var(--accent); }
.status__item--accent:hover { background: var(--accent-soft); }
.status__dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--fg-subtle); }
.status__dot--active { background: var(--success); }
.status__count--error { color: var(--error); }
.status__count--warn { color: var(--warning); }
</style>