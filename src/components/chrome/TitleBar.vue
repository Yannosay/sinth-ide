<script setup lang="ts">
import { computed } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEditorStore } from '@/stores/editor'
import { useWorkspaceStore } from '@/stores/workspace'
import IconButton from '@/components/ui/IconButton.vue'
import BrandMark from '@/components/chrome/BrandMark.vue'

const emit = defineEmits<{ (e: 'open-command-palette'): void; (e: 'open-settings'): void }>()

const editor = useEditorStore()
const workspace = useWorkspaceStore()

const title = computed(() => {
  const active = editor.activeTab
  const root = workspace.rootName
  if (active && root) return `${active.name} \u2014 ${root} \u2014 Sinth IDE`
  if (active) return `${active.name} \u2014 Sinth IDE`
  if (root) return `${root} \u2014 Sinth IDE`
  return 'Sinth IDE'
})

async function minimize(): Promise<void> { await getCurrentWindow().minimize() }
async function toggleMaximize(): Promise<void> { await getCurrentWindow().toggleMaximize() }
async function close(): Promise<void> { await getCurrentWindow().close() }
</script>

<template>
  <header class="titlebar">
    <div class="titlebar__left">
      <div class="titlebar__brand" data-tauri-drag-region>
        <BrandMark :size="18" label="IDE" />
      </div>
      <button class="titlebar__menu-item" type="button" @click="emit('open-command-palette')">
        <span>Command Palette</span>
        <kbd>Ctrl+Shift+P</kbd>
      </button>
      <button class="titlebar__menu-item" type="button" @click="emit('open-settings')">
        <span>Settings</span>
        <kbd>Ctrl+,</kbd>
      </button>
    </div>
    <div class="titlebar__center truncate">{{ title }}</div>
    <div class="titlebar__right">
      <IconButton title="Minimize" @click="minimize"><svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg></IconButton>
      <IconButton title="Maximize" @click="toggleMaximize"><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="1.5" /></svg></IconButton>
      <IconButton title="Close" variant="danger" @click="close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg></IconButton>
    </div>
  </header>
</template>

<style scoped>
.titlebar { display: flex; align-items: center; height: 36px; background: var(--bg-1); border-bottom: 1px solid var(--border); padding: 0 8px; gap: 8px; user-select: none; flex-shrink: 0; }
.titlebar__left, .titlebar__right { display: flex; align-items: center; gap: 6px; }
.titlebar__brand { display: flex; align-items: center; gap: 6px; padding: 0 8px 0 4px; }
.titlebar__menu-item { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: var(--radius-sm); color: var(--fg-muted); font-size: 12px; transition: background 80ms, color 80ms; }
.titlebar__menu-item:hover { background: var(--bg-3); color: var(--fg); }
.titlebar__menu-item kbd { font-family: var(--font-mono); font-size: 10px; color: var(--fg-subtle); background: var(--bg-3); border: 1px solid var(--border); border-radius: 3px; padding: 1px 4px; }
.titlebar__center { flex: 1; text-align: center; font-size: 12px; color: var(--fg-muted); min-width: 0; padding: 0 12px; }
.titlebar__right { gap: 2px; }
.titlebar__right :deep(.icon-button) { width: 32px; height: 26px; border-radius: var(--radius-sm); }
</style>