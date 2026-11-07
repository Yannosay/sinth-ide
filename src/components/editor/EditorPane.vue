<script setup lang="ts">
import { computed } from 'vue'
import EditorTabs from './EditorTabs.vue'
import MonacoEditor from './MonacoEditor.vue'
import { useEditorStore } from '@/stores/editor'

const editor = useEditorStore()
const active = computed(() => editor.activeTab)
</script>

<template>
  <div class="editor-pane">
    <EditorTabs />
    <div class="editor-pane__body">
      <div v-if="!active" class="editor-pane__empty">
        <p>No file open.</p>
        <p class="editor-pane__hint">Open a file from the Explorer or press Ctrl+P to quick open.</p>
      </div>
      <MonacoEditor v-else :tab="active" />
    </div>
  </div>
</template>

<style scoped>
.editor-pane { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; background: var(--bg-0); }
.editor-pane__body { position: relative; flex: 1; min-height: 0; overflow: hidden; }
.editor-pane__empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--fg-muted); font-size: 13px; gap: 6px; }
.editor-pane__hint { font-size: 11px; color: var(--fg-subtle); }
</style>