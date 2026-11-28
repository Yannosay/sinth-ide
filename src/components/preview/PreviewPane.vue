<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { open as openUrl } from '@tauri-apps/plugin-shell'
import { usePreviewStore, DEVICE_WIDTH, type PreviewDevice } from '@/stores/preview'
import { useProjectStore } from '@/stores/project'
import { useTasksStore } from '@/stores/tasks'
import IconButton from '@/components/ui/IconButton.vue'

const preview = usePreviewStore()
const project = useProjectStore()
const tasks = useTasksStore()

const address = ref(preview.path)
const loading = ref(false)
watch(() => preview.path, p => { address.value = p })
watch(() => [preview.src, preview.reloadKey], () => { if (preview.src) loading.value = true })

const devAction = computed(() => project.actions.find(a => a.id === 'dev') ?? null)
const starting = computed(() => !!tasks.byAction('dev') && !preview.origin)
const frameWidth = computed(() => DEVICE_WIDTH[preview.device])

const devices: Array<{ id: PreviewDevice; label: string }> = [
  { id: 'fill', label: 'Fit to panel' },
  { id: 'tablet', label: 'Tablet, 768 px' },
  { id: 'mobile', label: 'Phone, 390 px' },
]

function submit(): void { preview.navigate(address.value) }
function openExternal(): void { if (preview.src) void openUrl(preview.src) }
function start(): void { if (devAction.value) project.runAction(devAction.value) }
</script>

<template>
  <section class="preview" aria-label="Preview">
    <header class="preview__bar">
      <IconButton title="Reload" size="sm" :disabled="!preview.src" @click="preview.reload()">
        <svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
      </IconButton>
      <form class="preview__address" @submit.prevent="submit">
        <span class="preview__origin">{{ (preview.origin ?? preview.lastOrigin ?? 'localhost').replace(/^https?:\/\//, '') }}</span>
        <input v-model="address" class="preview__path" spellcheck="false" aria-label="Path" :disabled="!preview.src">
      </form>
      <div class="preview__devices" role="group" aria-label="Viewport">
        <IconButton v-for="d in devices" :key="d.id" :title="d.label" size="sm" :active="preview.device === d.id" @click="preview.device = d.id">
          <svg v-if="d.id === 'fill'" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
          <svg v-else-if="d.id === 'tablet'" viewBox="0 0 24 24"><rect x="5" y="2.5" width="14" height="19" rx="2" /><path d="M11 18.5h2" /></svg>
          <svg v-else viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></svg>
        </IconButton>
      </div>
      <IconButton title="Open in browser" size="sm" :disabled="!preview.src" @click="openExternal">
        <svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
      </IconButton>
      <IconButton title="Close preview" size="sm" @click="preview.hide()">
        <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </IconButton>
    </header>
    <div class="preview__stage" :class="{ 'preview__stage--device': frameWidth }">
      <iframe
        v-if="preview.src"
        :key="preview.reloadKey"
        class="preview__frame"
        :style="frameWidth ? { width: frameWidth + 'px' } : undefined"
        :src="preview.src"
        title="Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        allow="clipboard-read; clipboard-write"
        @load="loading = false"
      />
      <div v-if="preview.src && loading" class="preview__loading" aria-hidden="true" />
      <div v-if="!preview.src" class="preview__empty">
        <template v-if="starting">
          <p class="preview__title">Starting the dev server</p>
          <p class="preview__text">The page appears here as soon as it is ready.</p>
        </template>
        <template v-else-if="devAction">
          <p class="preview__title">{{ preview.lastOrigin ? 'The dev server stopped' : 'Nothing running yet' }}</p>
          <p class="preview__text">Run starts the dev server. Saved changes show up here instantly.</p>
          <button class="btn btn--primary" type="button" @click="start">Run</button>
        </template>
        <template v-else>
          <p class="preview__title">No Sinth project</p>
          <p class="preview__text">Open a folder with a pages/ directory or a sinth.config.json to preview it.</p>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.preview { display: flex; flex-direction: column; height: 100%; min-width: 0; background: var(--bg-1); border-left: 1px solid var(--border); }
.preview__bar { display: flex; align-items: center; gap: 4px; height: 36px; flex: 0 0 36px; padding: 0 6px; border-bottom: 1px solid var(--border); }
.preview__address { flex: 1; min-width: 0; display: flex; align-items: center; height: 24px; padding: 0 10px; border-radius: var(--radius-sm); background: var(--bg-0); border: 1px solid var(--border); font-family: var(--font-mono); font-size: 11px; }
.preview__address:focus-within { border-color: var(--accent); }
.preview__origin { color: var(--fg-subtle); white-space: nowrap; }
.preview__path { flex: 1; min-width: 0; background: none; border: none; outline: none; color: var(--fg); font: inherit; padding: 0; }
.preview__path:disabled { color: var(--fg-subtle); }
.preview__devices { display: flex; gap: 1px; padding: 0 4px; margin: 0 2px; border-left: 1px solid var(--border); border-right: 1px solid var(--border); }
.preview__stage { position: relative; flex: 1; min-height: 0; display: flex; justify-content: center; background: #fff; overflow: auto; }
.preview__stage--device { background: var(--bg-0); padding: 16px; }
.preview__stage--device .preview__frame { border-radius: 10px; box-shadow: 0 0 0 1px var(--border-strong), var(--shadow-md); flex: 0 0 auto; }
.preview__frame { width: 100%; height: 100%; border: 0; background: #fff; }
.preview__loading { position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--accent), transparent); background-size: 50% 100%; background-repeat: no-repeat; animation: preview-load 1s linear infinite; }
@keyframes preview-load { from { background-position: -50% 0; } to { background-position: 150% 0; } }
.preview__empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; background: var(--bg-1); }
.preview__title { margin: 0; font-size: 13px; font-weight: 500; color: var(--fg); }
.preview__text { margin: 0 0 8px; max-width: 280px; font-size: 11.5px; line-height: 1.6; color: var(--fg-muted); }
</style>
