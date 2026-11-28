<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open as openUrl } from '@tauri-apps/plugin-shell'
import { useEditorStore } from '@/stores/editor'
import { useWorkspaceStore } from '@/stores/workspace'
import { isServer, useProjectStore, type ProjectAction } from '@/stores/project'
import { useTasksStore } from '@/stores/tasks'
import { usePreviewStore } from '@/stores/preview'
import { platformShortcut } from '@/composables/useShortcutRouter'
import IconButton from '@/components/ui/IconButton.vue'
import BrandMark from '@/components/chrome/BrandMark.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import { useSettingsStore } from '@/stores/settings'

const emit = defineEmits<{ (e: 'open-command-palette'): void; (e: 'quick-open'): void; (e: 'open-folder'): void }>()

const editor = useEditorStore()
const workspace = useWorkspaceStore()
const project = useProjectStore()
const tasks = useTasksStore()
const preview = usePreviewStore()
const settings = useSettingsStore()

const menu = ref<{ x: number; y: number } | null>(null)
const menuItems = computed(() => {
  const recent = settings.recentFolders.filter(p => p !== workspace.rootPath).slice(0, 6)
  return [
    ...recent.map(p => ({ id: 'recent:' + p, label: p.split(/[\\/]/).pop() || p, hint: p })),
    { id: 'open', label: 'Open folder', hint: platformShortcut('Ctrl+Shift+O'), separator: recent.length > 0 },
    ...(workspace.rootPath ? [{ id: 'close', label: 'Close folder' }] : []),
  ]
})

function openMenu(e: MouseEvent): void {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  menu.value = { x: r.left, y: r.bottom + 4 }
}

async function onMenu(id: string): Promise<void> {
  if (id === 'open') { emit('open-folder'); return }
  if (id === 'close') {
    if (await editor.requestCloseAll()) workspace.close()
    return
  }
  const path = id.slice('recent:'.length)
  try { await workspace.openFolder(path); settings.pushRecentFolder(path) } catch (err) { console.error('[titlebar]', err) }
}

const windowTitle = computed(() => [editor.activeTab?.name, workspace.rootName, 'Sinth IDE'].filter(Boolean).join(' · '))
watch(windowTitle, t => { document.title = t; void getCurrentWindow().setTitle(t).catch(() => undefined) }, { immediate: true })

const primary = computed(() => project.actions.find(a => a.kind === 'run') ?? null)
const secondary = computed(() => project.actions.filter(a => a !== primary.value))
const serverUrl = computed(() => tasks.running.find(t => t.url)?.url ?? null)

function running(a: ProjectAction): boolean { return !!tasks.byAction(a.id) }

function hint(a: ProjectAction): string {
  if (!running(a)) return `${a.label}: ${a.program} ${a.args.join(' ')}`
  return isServer(a) ? `Stop ${a.label.toLowerCase()}` : `${a.label} is running`
}

async function minimize(): Promise<void> { await getCurrentWindow().minimize() }
async function toggleMaximize(): Promise<void> { await getCurrentWindow().toggleMaximize() }
async function close(): Promise<void> { await getCurrentWindow().close() }
</script>

<template>
  <header class="titlebar" data-tauri-drag-region>
    <div class="titlebar__left" data-tauri-drag-region>
      <BrandMark :size="18" class="titlebar__logo" />
      <button class="titlebar__project" type="button" :title="workspace.rootPath ?? 'Open a folder'" aria-haspopup="menu" @click="openMenu">
        <span class="truncate">{{ workspace.rootName ?? 'Open folder' }}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </div>

    <div class="titlebar__actions" data-tauri-drag-region>
      <template v-if="project.nodeMissing">
        <span class="titlebar__note">Sinth needs Node.js 18 or newer.</span>
        <button class="btn btn--link titlebar__link" type="button" @click="openUrl('https://nodejs.org/en/download')">Get Node.js</button>
        <button class="btn btn--link titlebar__link" type="button" @click="project.detect()">Retry</button>
      </template>
      <template v-else>
        <button
          v-if="primary"
          type="button"
          class="run"
          :class="{ 'run--stop': running(primary) }"
          :title="hint(primary)"
          @click="project.runAction(primary)"
        >
          <svg v-if="running(primary)" viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5" /></svg>
          <svg v-else viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z" /></svg>
          <span>{{ running(primary) ? 'Stop' : primary.label }}</span>
        </button>
        <button
          v-for="a in secondary"
          :key="a.id"
          type="button"
          class="action"
          :class="{ 'action--running': running(a) }"
          :title="hint(a)"
          :disabled="running(a) && !isServer(a)"
          @click="project.runAction(a)"
        >
          <span v-if="running(a) && !isServer(a)" class="action__spinner" aria-hidden="true" />
          <svg v-else-if="running(a)" viewBox="0 0 24 24" width="9" height="9" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5" /></svg>
          <span>{{ running(a) && isServer(a) ? `Stop ${a.label.toLowerCase()}` : a.label }}</span>
        </button>
        <button v-if="serverUrl" class="titlebar__url" type="button" :title="`Open ${serverUrl} in your browser`" @click="openUrl(serverUrl)">
          <span class="titlebar__live" aria-hidden="true" />{{ serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') }}
        </button>
      </template>
    </div>

    <div class="titlebar__center" data-tauri-drag-region>
      <button class="search" type="button" :title="`Search files (${platformShortcut('Ctrl+P')}), commands (${platformShortcut('Ctrl+Shift+P')})`" @click="workspace.rootPath ? emit('quick-open') : emit('open-command-palette')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span class="truncate">{{ workspace.rootPath ? `Search ${workspace.rootName}` : 'Search commands' }}</span>
        <kbd class="kbd">{{ platformShortcut(workspace.rootPath ? 'Ctrl+P' : 'Ctrl+Shift+P') }}</kbd>
      </button>
    </div>

    <div class="titlebar__right" data-tauri-drag-region>
      <IconButton v-if="project.isSinth" :title="`${preview.visible ? 'Hide' : 'Show'} preview (${platformShortcut('Ctrl+Shift+V')})`" :active="preview.visible" @click="preview.toggle()">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M14 4v16" /></svg>
      </IconButton>
      <span class="titlebar__sep" />
      <button class="win" type="button" aria-label="Minimize" @click="minimize"><svg viewBox="0 0 12 12"><path d="M2 6h8" /></svg></button>
      <button class="win" type="button" aria-label="Maximize" @click="toggleMaximize"><svg viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" rx="1" /></svg></button>
      <button class="win win--close" type="button" aria-label="Close" @click="close"><svg viewBox="0 0 12 12"><path d="m3 3 6 6M9 3 3 9" /></svg></button>
    </div>
    <ContextMenu v-if="menu" :x="menu.x" :y="menu.y" :items="menuItems" @select="onMenu" @close="menu = null" />
  </header>
</template>

<style scoped>
.titlebar { display: flex; align-items: center; gap: 10px; height: 42px; flex: 0 0 42px; padding-left: 12px; background: var(--bg-0); border-bottom: 1px solid var(--border); user-select: none; }
.titlebar__left { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 240px; flex-shrink: 0; }
.titlebar__logo { pointer-events: none; }
.titlebar__project { display: inline-flex; align-items: center; gap: 6px; min-width: 0; height: 28px; padding: 0 8px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; color: var(--fg); }
.titlebar__project svg { color: var(--fg-subtle); flex-shrink: 0; }
.titlebar__project:hover { background: var(--bg-3); }
.titlebar__actions:empty { display: none; }
.titlebar__actions { display: flex; align-items: center; gap: 2px; padding-left: 10px; border-left: 1px solid var(--border); height: 22px; flex-shrink: 0; }
.run { display: inline-flex; align-items: center; gap: 7px; height: 26px; padding: 0 12px 0 10px; margin-right: 6px; border-radius: var(--radius-sm); background: var(--fg); color: var(--bg-0); font-size: 11.5px; font-weight: 500; transition: background 120ms var(--ease); }
.run:hover { background: var(--accent-hover); }
.run--stop { background: rgba(248, 113, 113, 0.12); color: var(--error); box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.35); }
.run--stop:hover { background: rgba(248, 113, 113, 0.2); }
.action { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px; border-radius: var(--radius-sm); color: var(--fg-muted); font-size: 11.5px; transition: background 120ms var(--ease), color 120ms var(--ease); }
.action:hover:not(:disabled) { background: var(--bg-3); color: var(--fg); }
.action:disabled { cursor: default; }
.action--running { color: var(--fg); background: var(--bg-3); }
.action--running svg { color: var(--error); }
.action__spinner { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid currentColor; border-right-color: transparent; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.titlebar__url { display: inline-flex; align-items: center; gap: 7px; height: 26px; padding: 0 9px; margin-left: 4px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11px; color: var(--fg-muted); }
.titlebar__url:hover { background: var(--bg-3); color: var(--fg); }
.titlebar__live { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.15); }
.titlebar__note { font-size: 11.5px; color: var(--fg-muted); padding: 0 6px; white-space: nowrap; }
.titlebar__link { height: 26px; color: var(--accent); }
.titlebar__center { flex: 1; min-width: 120px; display: flex; justify-content: center; }
.search { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 380px; min-width: 0; height: 28px; padding: 0 6px 0 10px; border-radius: var(--radius-sm); background: var(--bg-2); border: 1px solid var(--border); color: var(--fg-subtle); font-size: 11.5px; transition: border-color 120ms var(--ease), color 120ms var(--ease); }
.search:hover { border-color: var(--border-strong); color: var(--fg-muted); }
.search > span { flex: 1; text-align: left; }
.titlebar__right { display: flex; align-items: center; gap: 2px; height: 100%; flex-shrink: 0; }
.titlebar__sep { width: 1px; height: 18px; margin: 0 6px; background: var(--border); }
.win { width: 44px; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--fg-muted); transition: background 100ms, color 100ms; }
.win svg { width: 11px; height: 11px; fill: none; stroke: currentColor; stroke-width: 1.1; }
.win:hover { background: var(--bg-3); color: var(--fg); }
.win--close:hover { background: #e5484d; color: #fff; }
</style>
