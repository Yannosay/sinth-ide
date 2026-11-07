<script setup lang="ts">
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '@/stores/workspace'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import Spinner from '@/components/ui/Spinner.vue'

interface SearchHit {
  path: string
  line: number
  column: number
  preview: string
}

const workspace = useWorkspaceStore()
const editor = useEditorStore()
const settings = useSettingsStore()

const query = ref('')
const caseSensitive = ref(false)
const results = ref<SearchHit[]>([])
const searching = ref(false)
const error = ref<string | null>(null)

async function runSearch(): Promise<void> {
  if (!workspace.rootPath || query.value.trim().length === 0) {
    results.value = []
    return
  }
  searching.value = true
  error.value = null
  try {
    results.value = await invoke<SearchHit[]>('search_in_folder', {
      path: workspace.rootPath,
      query: query.value,
      caseSensitive: caseSensitive.value
    })
  } catch (err) {
    error.value = String(err)
    results.value = []
  } finally {
    searching.value = false
  }
}

async function openHit(hit: SearchHit): Promise<void> {
  try {
    const content = await invoke<string>('read_text_file', { path: hit.path })
    editor.openFile(hit.path, content)
    settings.pushRecentFile(hit.path)
  } catch (err) { console.error('[search]', err) }
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}
</script>

<template>
  <div class="panel">
    <header class="panel__header"><span class="panel__title">Search</span></header>
    <div class="panel__body">
      <div class="search">
        <input v-model="query" type="search" placeholder="Search in folder" class="search__input" :disabled="!workspace.rootPath" @keydown.enter="runSearch">
        <label class="search__toggle">
          <input v-model="caseSensitive" type="checkbox">
          <span>Match case</span>
        </label>
        <button class="search__run" type="button" :disabled="!workspace.rootPath || query.trim().length === 0 || searching" @click="runSearch">
          {{ searching ? 'Searching' : 'Search' }}
        </button>
      </div>
      <div v-if="!workspace.rootPath" class="empty"><p>Open a folder to search.</p></div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="searching" class="loading"><Spinner :size="14" /></div>
      <div v-else-if="results.length === 0 && query.length > 0" class="empty"><p>No matches.</p></div>
      <ul v-else class="results">
        <li v-for="(r, idx) in results" :key="idx" class="results__item">
          <button type="button" class="results__btn" @click="openHit(r)">
            <div class="results__head">
              <span class="results__file truncate">{{ basename(r.path) }}</span>
              <span class="results__loc">:{{ r.line }}:{{ r.column }}</span>
            </div>
            <div class="results__preview truncate mono">{{ r.preview }}</div>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; height: 100%; background: var(--bg-1); }
.panel__header { display: flex; align-items: center; height: 32px; flex: 0 0 32px; padding: 0 12px; border-bottom: 1px solid var(--border); }
.panel__title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); }
.panel__body { flex: 1; overflow: auto; min-height: 0; padding: 12px; }
.search { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.search__input { width: 100%; padding: 6px 10px; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--fg); font: inherit; font-size: 12px; }
.search__input:focus { outline: none; border-color: var(--accent); }
.search__toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-muted); }
.search__run { align-self: flex-start; padding: 5px 12px; background: var(--accent); color: var(--accent-fg); border-radius: var(--radius-sm); font-size: 11px; font-weight: 500; }
.search__run:disabled { opacity: 0.4; cursor: not-allowed; }
.empty { padding: 16px 8px; text-align: center; color: var(--fg-muted); font-size: 12px; }
.error { padding: 12px; color: var(--error); font-size: 12px; }
.loading { display: flex; justify-content: center; padding: 24px; }
.results { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.results__item { border-radius: var(--radius-sm); }
.results__btn { width: 100%; text-align: left; padding: 6px 8px; border-radius: var(--radius-sm); }
.results__btn:hover { background: var(--bg-2); }
.results__head { display: flex; align-items: baseline; gap: 4px; margin-bottom: 2px; }
.results__file { font-weight: 500; font-size: 12px; }
.results__loc { font-size: 10px; color: var(--fg-subtle); font-family: var(--font-mono); }
.results__preview { font-size: 11px; color: var(--fg-muted); }
</style>