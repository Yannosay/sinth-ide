<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import IconButton from '@/components/ui/IconButton.vue'

const editor = useEditorStore()

function onClose(e: MouseEvent, id: string): void {
  e.stopPropagation()
  editor.closeTab(id)
}
</script>

<template>
  <div class="tabs">
    <div class="tabs__scroll">
      <div
        v-for="tab in editor.tabs"
        :key="tab.id"
        class="tab"
        :class="{ 'tab--active': tab.id === editor.activeTabId }"
        @click="editor.setActive(tab.id)"
        @auxclick="e => { if (e.button === 1) onClose(e, tab.id) }"
      >
        <span v-if="tab.language === 'sinth'" class="tab__lang tab__lang--sinth">S</span>
        <span class="tab__label truncate">{{ tab.name }}</span>
        <span v-if="tab.dirty" class="tab__dirty" title="Unsaved changes">\u25cf</span>
        <button class="tab__close" type="button" :title="`Close ${tab.name}`" @click="e => onClose(e, tab.id)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    <div class="tabs__actions">
      <IconButton title="Close active tab (Ctrl+W)" size="sm" :disabled="!editor.activeTabId" @click="() => { if (editor.activeTabId) editor.closeTab(editor.activeTabId) }">
        <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </IconButton>
    </div>
  </div>
</template>

<style scoped>
.tabs { display: flex; align-items: stretch; height: 32px; flex: 0 0 32px; background: var(--bg-1); border-bottom: 1px solid var(--border); }
.tabs__scroll { flex: 1; display: flex; overflow-x: auto; scrollbar-width: none; }
.tabs__scroll::-webkit-scrollbar { display: none; }
.tab { display: flex; align-items: center; gap: 6px; padding: 0 8px 0 12px; min-width: 100px; max-width: 220px; border-right: 1px solid var(--border); cursor: pointer; color: var(--fg-muted); font-size: 12px; position: relative; transition: background 60ms, color 60ms; }
.tab:hover { background: var(--bg-2); color: var(--fg); }
.tab--active { background: var(--bg-0); color: var(--fg); }
.tab--active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: var(--bg-0); }
.tab--active::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--accent); }
.tab__lang { width: 14px; height: 14px; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; background: var(--accent-soft); color: var(--accent); flex-shrink: 0; }
.tab__lang--sinth { background: var(--accent); color: var(--accent-fg); }
.tab__label { flex: 1; min-width: 0; }
.tab__dirty { color: var(--accent); font-size: 10px; }
.tab__close { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 3px; color: var(--fg-subtle); opacity: 0; transition: opacity 80ms, background 80ms; }
.tab:hover .tab__close, .tab--active .tab__close { opacity: 1; }
.tab__close:hover { background: var(--bg-3); color: var(--fg); }
.tabs__actions { display: flex; align-items: center; padding: 0 6px; border-left: 1px solid var(--border); }
</style>