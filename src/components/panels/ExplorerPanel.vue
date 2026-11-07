<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore, type FileNode } from '@/stores/workspace'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import IconButton from '@/components/ui/IconButton.vue'
import Spinner from '@/components/ui/Spinner.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'

const workspace = useWorkspaceStore()
const editor = useEditorStore()
const settings = useSettingsStore()

const busy = ref(false)
const inlineAction = ref<null | { kind: 'file' | 'folder' | 'rename'; parentDir: string; target?: string }>(null)
const inlineName = ref('')
const inlineRef = ref<HTMLInputElement | null>(null)
const contextMenu = ref<null | { x: number; y: number; path: string; isDirectory: boolean }>(null)

const menuItems = computed(() => {
  if (!contextMenu.value) return []
  const isDir = contextMenu.value.isDirectory
  return [
    ...(isDir ? [{ id: 'new-file', label: 'New File' }, { id: 'new-folder', label: 'New Folder' }] : []),
    { id: 'rename', label: 'Rename' },
    { id: 'reveal', label: 'Copy Full Path' },
    { id: 'delete', label: 'Delete', danger: true }
  ]
})

async function pickFolder(): Promise<void> {
  const picked = await open({ directory: true, multiple: false })
  if (typeof picked !== 'string') return
  busy.value = true
  try { await workspace.openFolder(picked); settings.pushRecentFolder(picked) }
  catch (err) { console.error('[explorer]', err) }
  finally { busy.value = false }
}

async function refresh(): Promise<void> {
  busy.value = true
  try { await workspace.refresh() } finally { busy.value = false }
}

async function onClickNode(node: FileNode): Promise<void> {
  workspace.select(node.path)
  if (node.isDirectory) {
    await workspace.toggle(node.path)
    return
  }
  try {
    const content = await invoke<string>('read_text_file', { path: node.path })
    editor.openFile(node.path, content)
    settings.pushRecentFile(node.path)
  } catch (err) { console.error('[explorer]', err) }
}

function onContextMenu(e: MouseEvent, node: FileNode): void {
  e.preventDefault()
  workspace.select(node.path)
  contextMenu.value = { x: e.clientX, y: e.clientY, path: node.path, isDirectory: node.isDirectory }
}

function closeContextMenu(): void {
  contextMenu.value = null
}

async function onMenuSelect(id: string): Promise<void> {
  const ctx = contextMenu.value
  if (!ctx) return

  if (id === 'new-file' || id === 'new-folder') {
    const parentDir = ctx.isDirectory ? ctx.path : workspace.parentDirectoryOf(ctx.path)
    inlineAction.value = { kind: id === 'new-file' ? 'file' : 'folder', parentDir }
    inlineName.value = ''
    setTimeout(() => inlineRef.value?.focus(), 50)
    return
  }

  if (id === 'rename') {
    inlineAction.value = { kind: 'rename', parentDir: workspace.parentDirectoryOf(ctx.path), target: ctx.path }
    inlineName.value = ctx.path.split(/[\\/]/).pop() ?? ''
    setTimeout(() => { inlineRef.value?.focus(); inlineRef.value?.select() }, 50)
    return
  }

  if (id === 'reveal') {
    try { await navigator.clipboard.writeText(ctx.path) } catch { void 0 }
    return
  }

  if (id === 'delete') {
    const name = ctx.path.split(/[\\/]/).pop() ?? ctx.path
    const confirmed = window.confirm(`Delete "${name}"? This cannot be undone.`)
    if (!confirmed) return
    try { await workspace.remove(ctx.path) }
    catch (err) { console.error('[explorer]', err) }
    return
  }
}

function startNewFileInRoot(): void {
  if (!workspace.rootPath) return
  inlineAction.value = { kind: 'file', parentDir: workspace.rootPath }
  inlineName.value = ''
  setTimeout(() => inlineRef.value?.focus(), 50)
}

function startNewFolderInRoot(): void {
  if (!workspace.rootPath) return
  inlineAction.value = { kind: 'folder', parentDir: workspace.rootPath }
  inlineName.value = ''
  setTimeout(() => inlineRef.value?.focus(), 50)
}

async function commitInline(): Promise<void> {
  const action = inlineAction.value
  if (!action) return
  const name = inlineName.value.trim()
  if (!name) { cancelInline(); return }

  try {
    if (action.kind === 'file') {
      const created = await workspace.createFile(action.parentDir, name)
      editor.openFile(created, '')
      settings.pushRecentFile(created)
    } else if (action.kind === 'folder') {
      await workspace.createFolder(action.parentDir, name)
    } else if (action.kind === 'rename' && action.target) {
      await workspace.rename(action.target, name)
    }
  } catch (err) {
    console.error('[explorer] inline action failed:', err)
  } finally {
    cancelInline()
  }
}

function cancelInline(): void {
  inlineAction.value = null
  inlineName.value = ''
}

function onInlineKey(e: KeyboardEvent): void {
  if (e.key === 'Enter') { e.preventDefault(); void commitInline() }
  else if (e.key === 'Escape') { e.preventDefault(); cancelInline() }
}

onMounted(() => {
  if (!workspace.rootPath && settings.recentFolders.length > 0) {
    void workspace.openFolder(settings.recentFolders[0]).catch(() => void 0)
  }
})

function indentStyle(depth: number): Record<string, string> {
  return { paddingLeft: `${8 + depth * 14}px` }
}

interface RenderedRow {
  node: FileNode
  depth: number
}

function renderNodes(nodes: FileNode[], depth: number): RenderedRow[] {
  const out: RenderedRow[] = []
  for (const n of nodes) {
    out.push({ node: n, depth })
    if (n.isDirectory && workspace.isExpanded(n.path) && n.children) {
      out.push(...renderNodes(n.children, depth + 1))
    }
  }
  return out
}

const rows = computed(() => renderNodes(workspace.tree, 0))

function isRenaming(path: string): boolean {
  return inlineAction.value?.kind === 'rename' && inlineAction.value.target === path
}

function rowVisibleForInline(parentDir: string): boolean {
  return !!inlineAction.value && inlineAction.value.kind !== 'rename' && inlineAction.value.parentDir === parentDir
}

function parentInlineDepth(parentDir: string): number | null {
  for (const row of rows.value) {
    if (row.node.path === parentDir) return row.depth + 1
  }
  if (workspace.rootPath === parentDir) return 0
  return null
}
</script>

<template>
  <div class="panel">
    <header class="panel__header">
      <span class="panel__title">Explorer</span>
      <div class="panel__actions">
        <IconButton title="New file" size="sm" :disabled="!workspace.rootPath" @click="startNewFileInRoot">
          <svg viewBox="0 0 24 24"><path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM12 11v6M9 14h6" /></svg>
        </IconButton>
        <IconButton title="New folder" size="sm" :disabled="!workspace.rootPath" @click="startNewFolderInRoot">
          <svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 11v6M9 14h6" /></svg>
        </IconButton>
        <IconButton title="Open folder (Ctrl+Shift+O)" size="sm" @click="pickFolder">
          <svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
        </IconButton>
        <IconButton title="Refresh" size="sm" :disabled="!workspace.rootPath || busy" @click="refresh">
          <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
        </IconButton>
      </div>
    </header>

    <div class="panel__body">
      <div v-if="busy" class="panel__loading"><Spinner :size="16" /></div>

      <div v-else-if="!workspace.rootPath" class="panel__empty">
        <p class="panel__empty-title">No folder opened</p>
        <p class="panel__empty-hint">Open a folder containing .sinth files to begin.</p>
        <button class="panel__empty-btn" type="button" @click="pickFolder">Open Folder</button>
        <ul v-if="settings.recentFolders.length" class="panel__recent">
          <li v-for="p in settings.recentFolders.slice(0, 5)" :key="p">
            <button type="button" class="panel__recent-btn" @click="workspace.openFolder(p)">
              <span class="truncate">{{ p }}</span>
            </button>
          </li>
        </ul>
      </div>

      <div v-else class="tree">
        <div v-if="rowVisibleForInline(workspace.rootPath!)" class="tree__row" :style="indentStyle(0)">
          <span class="tree__chevron" />
          <span class="tree__icon" />
          <input
            ref="inlineRef"
            v-model="inlineName"
            class="tree__inline"
            :placeholder="inlineAction?.kind === 'folder' ? 'folder name' : 'file name'"
            @keydown="onInlineKey"
            @blur="commitInline"
          >
        </div>

        <template v-for="row in rows" :key="row.node.path">
          <div
            class="tree__row"
            :class="{ 'tree__row--selected': workspace.selected === row.node.path }"
            :style="indentStyle(row.depth)"
            @click="onClickNode(row.node)"
            @contextmenu="onContextMenu($event, row.node)"
          >
            <span class="tree__chevron" :class="{ 'tree__chevron--open': workspace.isExpanded(row.node.path) }">
              <svg v-if="row.node.isDirectory" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </span>
            <span class="tree__icon">
              <svg v-if="row.node.isDirectory" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <svg v-else-if="row.node.name.endsWith('.sinth')" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="tree__icon-sinth">
                <path d="M20.5 9.5c-1-1-2.5-1.5-4.5-1.5-2.5 0-4 1-4 2.75 0 1.6 1.1 2.3 3.6 2.85l2 .45c1.5.35 2.4.9 2.4 2.05 0 1.5-1.4 2.4-3.6 2.4-1.9 0-3.4-.65-4.4-1.7" />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              </svg>
            </span>
            <input
              v-if="isRenaming(row.node.path)"
              ref="inlineRef"
              v-model="inlineName"
              class="tree__inline"
              @keydown="onInlineKey"
              @blur="commitInline"
            >
            <span v-else class="tree__label truncate">{{ row.node.name }}</span>
          </div>

          <div
            v-if="row.node.isDirectory && rowVisibleForInline(row.node.path)"
            class="tree__row"
            :style="indentStyle(row.depth + 1)"
          >
            <span class="tree__chevron" />
            <span class="tree__icon" />
            <input
              ref="inlineRef"
              v-model="inlineName"
              class="tree__inline"
              :placeholder="inlineAction?.kind === 'folder' ? 'folder name' : 'file name'"
              @keydown="onInlineKey"
              @blur="commitInline"
            >
          </div>
        </template>
      </div>
    </div>

    <ContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="menuItems"
      @select="onMenuSelect"
      @close="closeContextMenu"
    />
  </div>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; height: 100%; background: var(--bg-1); }
.panel__header { display: flex; align-items: center; justify-content: space-between; height: 32px; flex: 0 0 32px; padding: 0 8px 0 12px; border-bottom: 1px solid var(--border); }
.panel__title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); }
.panel__actions { display: flex; gap: 2px; }
.panel__body { flex: 1; overflow: auto; min-height: 0; }
.panel__loading { display: flex; align-items: center; justify-content: center; padding: 24px; color: var(--fg-muted); }
.panel__empty { padding: 24px 16px; text-align: center; }
.panel__empty-title { margin: 0 0 4px; font-weight: 600; }
.panel__empty-hint { margin: 0 0 16px; color: var(--fg-muted); font-size: 12px; }
.panel__empty-btn { padding: 6px 14px; border-radius: var(--radius-md); background: var(--accent); color: var(--accent-fg); font-weight: 500; font-size: 12px; }
.panel__empty-btn:hover { background: var(--accent-hover); }
.panel__recent { list-style: none; margin: 20px 0 0; padding: 0; text-align: left; }
.panel__recent li + li { margin-top: 4px; }
.panel__recent-btn { width: 100%; text-align: left; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px; color: var(--fg-muted); }
.panel__recent-btn:hover { background: var(--bg-2); color: var(--fg); }
.tree { padding: 4px 0; }
.tree__row { display: flex; align-items: center; gap: 4px; height: 22px; cursor: pointer; padding-right: 8px; font-size: 12px; color: var(--fg); transition: background 60ms; }
.tree__row:hover { background: var(--bg-2); }
.tree__row--selected { background: var(--accent-soft); }
.tree__chevron { display: inline-flex; width: 12px; height: 12px; color: var(--fg-subtle); transition: transform 80ms; }
.tree__chevron--open { transform: rotate(90deg); }
.tree__icon { display: inline-flex; width: 14px; height: 14px; color: var(--fg-muted); }
.tree__icon-sinth { color: var(--accent); }
.tree__label { flex: 1; min-width: 0; }
.tree__inline {
  flex: 1;
  min-width: 0;
  height: 18px;
  padding: 0 4px;
  background: var(--bg-0);
  border: 1px solid var(--accent);
  border-radius: 3px;
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  outline: none;
}
</style>