<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useConfirmStore } from '@/stores/confirm'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'

import TitleBar from '@/components/chrome/TitleBar.vue'
import ActivityBar, { type ActivityView } from '@/components/chrome/ActivityBar.vue'
import StatusBar from '@/components/chrome/StatusBar.vue'
import ExplorerPanel from '@/components/panels/ExplorerPanel.vue'
import CompilersPanel from '@/components/panels/CompilersPanel.vue'
import SearchPanel from '@/components/panels/SearchPanel.vue'
import SettingsPanel from '@/components/panels/SettingsPanel.vue'
import EditorPane from '@/components/editor/EditorPane.vue'
import TerminalPane from '@/components/terminal/TerminalPane.vue'
import CommandPalette from '@/components/dialogs/CommandPalette.vue'
import UpdateDialog from '@/components/dialogs/UpdateDialog.vue'
import WelcomeScreen from '@/components/WelcomeScreen.vue'
import SplitPane from '@/components/ui/SplitPane.vue'
import PreviewPane from '@/components/preview/PreviewPane.vue'
import { usePreviewStore } from '@/stores/preview'
import { useTasksStore } from '@/stores/tasks'

import { useEditorStore } from '@/stores/editor'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import { useCompilersStore } from '@/stores/compilers'
import { useDiagnosticsStore } from '@/stores/diagnostics'
import { useProjectStore } from '@/stores/project'
import { registerShortcuts } from '@/composables/useShortcutRouter'
import { useTauriEvent } from '@/composables/useTauriEvent'

const editor = useEditorStore()
const workspace = useWorkspaceStore()
const settings = useSettingsStore()
const compilers = useCompilersStore()
const diagnostics = useDiagnosticsStore()
const project = useProjectStore()
const preview = usePreviewStore()
const tasks = useTasksStore()
const confirm = useConfirmStore()
const showWelcome = computed(() => !workspace.rootPath && editor.tabs.length === 0)
const previewWidth = ref(settings.previewWidth)
watch(() => settings.previewWidth, v => { previewWidth.value = v })
watch(previewWidth, v => { settings.previewWidth = v })

watch(() => workspace.rootPath, () => { void project.detect() }, { immediate: true })

async function recheck(path?: string): Promise<void> {
  const root = workspace.rootPath
  if (!root) return
  if (!project.isSinth && (!path || /(\.sinth|[\\/]package\.json|[\\/]sinth\.config\.json)$/.test(path))) await project.detect()
  if (!project.isSinth) { diagnostics.clear(); return }
  if (!path || path.endsWith('.sinth') || path.endsWith('sinth.config.json')) void diagnostics.check(root)
}

watch(() => workspace.rootPath, root => {
  preview.hide()
  diagnostics.clear()
  if (root) void recheck()
})

const activityView = ref<ActivityView>('explorer')
const paletteOpen = ref(false)
const palettePrefix = ref('')
function openPalette(prefix: string): void { palettePrefix.value = prefix; paletteOpen.value = true }

async function pickFolder(): Promise<void> {
  const picked = await openDialog({ directory: true, multiple: false })
  if (typeof picked !== 'string') return
  await workspace.openFolder(picked)
  settings.pushRecentFolder(picked)
  activityView.value = 'explorer'
}
const terminalVisible = ref(true)
const terminalHeight = ref(settings.terminalHeight)
const sidebarWidth = ref(settings.sidebarWidth)

useTauriEvent<{
  version: string
  stage: string
  bytesReceived: number
  bytesTotal: number
  message: string
}>('compiler-install-progress', event => {
  compilers.applyProgress({
    version: event.payload.version,
    stage: event.payload.stage as never,
    bytesReceived: event.payload.bytesReceived,
    bytesTotal: event.payload.bytesTotal,
    message: event.payload.message
  })
})

async function reportSaveError(name: string, err: unknown): Promise<void> {
  await confirm.ask({ title: `Could not save ${name}`, message: String(err).replace(/^Error:\s*/, ''), choices: [{ id: 'ok', label: 'OK', kind: 'primary' }], cancel: 'ok' })
}

async function saveActive(): Promise<void> {
  const tab = editor.activeTab
  if (!tab || tab.readonly || !tab.dirty) return
  try {
    await editor.saveTab(tab.id)
    void recheck(tab.path)
  } catch (err) { void reportSaveError(tab.name, err) }
}

async function saveAll(): Promise<void> {
  for (const tab of editor.tabs) {
    if (tab.readonly || !tab.dirty) continue
    try { await editor.saveTab(tab.id) } catch (err) { void reportSaveError(tab.name, err); break }
  }
  void recheck()
}

// Files change outside the IDE (git, formatters, AI agents): refresh clean tabs and the tree.
async function syncWorkspace(): Promise<void> {
  if (!workspace.rootPath) return
  await editor.syncFromDisk()
}
function onFocus(): void {
  void syncWorkspace()
  if (workspace.rootPath) void workspace.refresh()
}
let syncTimer: ReturnType<typeof setInterval> | null = null
let unlistenClose: (() => void) | null = null

function refitTerminal(): void { requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))) }
function toggleTerminal(): void { terminalVisible.value = !terminalVisible.value; refitTerminal() }
function onTerminalRun(): void { if (!terminalVisible.value) { terminalVisible.value = true; refitTerminal() } }
function newTerminal(): void {
  terminalVisible.value = true
  requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('sinth:new-terminal')))
}

function onToggleTerminalEvent(): void { toggleTerminal() }
function onNewTerminalEvent(): void { newTerminal() }

registerShortcuts({
  onCommandPalette: () => openPalette('>'),
  onQuickOpen: () => openPalette(''),
  onSave: () => void saveActive(),
  onSaveAll: () => void saveAll(),
  onCloseTab: () => { if (editor.activeTabId) void editor.requestClose(editor.activeTabId) },
  onToggleTerminal: toggleTerminal,
  onNewTerminal: newTerminal,
  onToggleSidebar: () => { settings.activityBarVisible = !settings.activityBarVisible },
  onOpenSettings: () => { activityView.value = 'settings' },
  onSearch: () => { activityView.value = 'search' },
  onOpenFolder: () => void pickFolder(),
  onTogglePreview: () => preview.toggle()
})

watch(() => settings.terminalHeight, v => { terminalHeight.value = v })
watch(terminalHeight, v => { settings.terminalHeight = v })
watch(() => settings.sidebarWidth, v => { sidebarWidth.value = v })
watch(sidebarWidth, v => { settings.sidebarWidth = v })

onMounted(() => {
  window.addEventListener('focus', onFocus)
  syncTimer = setInterval(() => { void syncWorkspace() }, 2500)
  void getCurrentWindow().onCloseRequested(async event => {
    if (!editor.tabs.some(t => t.dirty)) return
    event.preventDefault()
    if (await editor.settleUnsaved(editor.tabs.filter(t => t.dirty))) await getCurrentWindow().destroy()
  }).then(u => { unlistenClose = u }).catch(() => undefined)
  window.addEventListener('sinth:toggle-terminal', onToggleTerminalEvent)
  window.addEventListener('sinth:new-terminal', onNewTerminalEvent)
  window.addEventListener('sinth:terminal-run', onTerminalRun)
})

onUnmounted(() => {
  window.removeEventListener('focus', onFocus)
  if (syncTimer) clearInterval(syncTimer)
  unlistenClose?.()
  window.removeEventListener('sinth:toggle-terminal', onToggleTerminalEvent)
  window.removeEventListener('sinth:new-terminal', onNewTerminalEvent)
  window.removeEventListener('sinth:terminal-run', onTerminalRun)
})
</script>

<template>
  <div class="workbench">
    <TitleBar
      @open-command-palette="openPalette('>')"
      @quick-open="openPalette('')"
      @open-folder="pickFolder"
    />
    <div class="workbench__body">
      <ActivityBar v-if="settings.activityBarVisible" v-model:view="activityView" />
      <SplitPane
        v-model:size="sidebarWidth"
        direction="horizontal"
        :min="200"
        :max="560"
        :hide-first="showWelcome && activityView === 'explorer'"
        class="workbench__split"
      >
        <template #first>
          <ExplorerPanel v-if="activityView === 'explorer'" />
          <CompilersPanel v-else-if="activityView === 'compilers'" />
          <SearchPanel v-else-if="activityView === 'search'" />
          <SettingsPanel v-else-if="activityView === 'settings'" />
        </template>
        <template #second>
          <div class="workbench__main">
            <div class="workbench__stage">
              <WelcomeScreen v-if="showWelcome" />
              <SplitPane
                v-else
                v-model:size="previewWidth"
                direction="horizontal"
                fixed="second"
                :min="300"
                :max="1400"
                :collapsed="!preview.visible"
                class="workbench__editor-row"
              >
                <template #first><EditorPane /></template>
                <template #second><PreviewPane /></template>
              </SplitPane>
            </div>
            <TerminalPane v-show="terminalVisible && (!showWelcome || tasks.running.length > 0)" v-model:height="terminalHeight" />
          </div>
        </template>
      </SplitPane>
    </div>
    <StatusBar
      v-if="settings.statusBarVisible"
      :terminal-visible="terminalVisible"
      @toggle-terminal="toggleTerminal"
    />
    <CommandPalette v-model:open="paletteOpen" :prefix="palettePrefix" />
    <UpdateDialog />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.workbench { display: flex; flex-direction: column; height: 100vh; width: 100vw; background: var(--bg-0); color: var(--fg); overflow: hidden; }
.workbench__body { flex: 1; display: flex; min-height: 0; overflow: hidden; }
.workbench__split { flex: 1; min-width: 0; }
.workbench__stage { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.workbench__editor-row { flex: 1; min-height: 0; }
.workbench__editor-row :deep(.split__first) { display: flex; flex-direction: column; }
.workbench__main { position: relative; display: flex; flex-direction: column; height: 100%; min-width: 0; overflow: hidden; }
</style>