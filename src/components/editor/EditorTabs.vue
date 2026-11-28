<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import FileIcon from '@/components/ui/FileIcon.vue'

const editor = useEditorStore()

function onClose(e: MouseEvent, id: string): void {
  e.stopPropagation()
  void editor.requestClose(id)
}
</script>

<template>
  <div v-if="editor.tabs.length" class="tabs">
    <div class="tabs__scroll">
      <div
        v-for="tab in editor.tabs"
        :key="tab.id"
        class="tab"
        :class="{ 'tab--active': tab.id === editor.activeTabId }"
        @click="editor.setActive(tab.id)"
        @auxclick="e => { if (e.button === 1) onClose(e, tab.id) }"
      >
        <FileIcon :name="tab.name" :size="14" />
        <span class="tab__label truncate">{{ tab.name }}</span>
        <span v-if="tab.dirty" class="tab__dirty" title="Unsaved changes" />
        <button class="tab__close" type="button" :title="`Close ${tab.name}`" @click="e => onClose(e, tab.id)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs { display: flex; align-items: stretch; height: 34px; flex: 0 0 34px; background: var(--bg-1); border-bottom: 1px solid var(--border); }
.tabs__scroll { flex: 1; display: flex; overflow-x: auto; scrollbar-width: none; }
.tabs__scroll::-webkit-scrollbar { display: none; }
.tab { display: flex; align-items: center; gap: 6px; padding: 0 8px 0 12px; min-width: 100px; max-width: 220px; border-right: 1px solid var(--border); cursor: pointer; color: var(--fg-muted); font-size: 11.5px; position: relative; transition: background 100ms, color 100ms; }
.tab:hover { background: var(--bg-2); color: var(--fg); }
.tab--active { background: var(--bg-0); color: var(--fg); }
.tab--active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: var(--bg-0); }
.tab--active::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--accent); }
.tab__label { flex: 1; min-width: 0; }
.tab__dirty { width: 7px; height: 7px; border-radius: 50%; background: var(--fg-muted); flex-shrink: 0; }
.tab__close { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 3px; color: var(--fg-subtle); opacity: 0; transition: opacity 80ms, background 80ms; }
.tab:hover .tab__close, .tab--active .tab__close { opacity: 1; }
.tab__close:hover { background: var(--bg-3); color: var(--fg); }
</style>