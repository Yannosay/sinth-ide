<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'

import TitleBar from '@/components/chrome/TitleBar.vue'
import ActivityBar, { type ActivityView } from '@/components/chrome/ActivityBar.vue'
import StatusBar from '@/components/chrome/StatusBar.vue'
import Toolbar from '@/components/chrome/Toolbar.vue'
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

async function recheck(path?: string): Promise<void> {
  const root = workspace.rootPath
  if (!root) return
  if (!project.isSinth && (!path || /(\.sinth|[\\/]package\.json|[\\/]sinth\.config\.json)$/.test(path))) await project.detect()
  if (!project.isSinth) { diagnostics.clear(); return }
  if (!path || path.endsWith('.sinth') || path.endsWith('sinth.config.json')) void diagnostics.check(root)
}

watch(() => workspace.rootPath, root => {
  diagnostics.clear()
  if (root) void recheck()
})

const activityView = ref<ActivityView>('explorer')
const paletteOpen = ref(false)
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

async function saveActive(): Promise<void> {
  const tab = editor.activeTab
  if (!tab || tab.readonly || !tab.dirty) return
  try {
    await invoke('write_text_file', { path: tab.path, content: tab.content })
    editor.markSaved(tab.id, tab.content)
    void recheck(tab.path)
  } catch (err) { console.error('[workbench]', err) }
}

async function saveAll(): Promise<void> {
  for (const tab of editor.tabs) {
    if (tab.readonly || !tab.dirty) continue
    try {
      await invoke('write_text_file', { path: tab.path, content: tab.content })
      editor.markSaved(tab.id, tab.content)
    } catch (err) { console.error('[workbench]', err) }
  }
  void recheck()
}

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
  onCommandPalette: () => { paletteOpen.value = true },
  onQuickOpen: () => { paletteOpen.value = true },
  onSave: () => void saveActive(),
  onSaveAll: () => void saveAll(),
  onCloseTab: () => { if (editor.activeTabId) editor.closeTab(editor.activeTabId) },
  onToggleTerminal: toggleTerminal,
  onNewTerminal: newTerminal,
  onToggleSidebar: () => { settings.activityBarVisible = !settings.activityBarVisible },
  onOpenSettings: () => { activityView.value = 'settings' },
  onSearch: () => { activityView.value = 'search' },
  onOpenFolder: () => { activityView.value = 'explorer' }
})

watch(() => settings.terminalHeight, v => { terminalHeight.value = v })
watch(terminalHeight, v => { settings.terminalHeight = v })
watch(() => settings.sidebarWidth, v => { sidebarWidth.value = v })
watch(sidebarWidth, v => { settings.sidebarWidth = v })

onMounted(() => {
  window.addEventListener('sinth:toggle-terminal', onToggleTerminalEvent)
  window.addEventListener('sinth:new-terminal', onNewTerminalEvent)
  window.addEventListener('sinth:terminal-run', onTerminalRun)
})

onUnmounted(() => {
  window.removeEventListener('sinth:toggle-terminal', onToggleTerminalEvent)
  window.removeEventListener('sinth:new-terminal', onNewTerminalEvent)
  window.removeEventListener('sinth:terminal-run', onTerminalRun)
})
</script>

<template>
  <div class="workbench">
    <TitleBar
      @open-command-palette="paletteOpen = true"
      @open-settings="activityView = 'settings'"
    />
    <Toolbar />
    <div class="workbench__body">
      <ActivityBar v-if="settings.activityBarVisible" v-model:view="activityView" />
      <SplitPane
        v-model:size="sidebarWidth"
        direction="horizontal"
        :min="200"
        :max="560"
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
            <WelcomeScreen v-if="!workspace.rootPath && editor.tabs.length === 0" />
            <template v-else>
              <EditorPane />
              <TerminalPane v-show="terminalVisible" v-model:height="terminalHeight" />
            </template>
          </div>
        </template>
      </SplitPane>
    </div>
    <StatusBar
      v-if="settings.statusBarVisible"
      :terminal-visible="terminalVisible"
      @toggle-terminal="toggleTerminal"
    />
    <CommandPalette v-model:open="paletteOpen" />
    <UpdateDialog />
  </div>
</template>

<style scoped>
.workbench { display: flex; flex-direction: column; height: 100vh; width: 100vw; background: var(--bg-0); color: var(--fg); overflow: hidden; }
.workbench__body { flex: 1; display: flex; min-height: 0; overflow: hidden; }
.workbench__split { flex: 1; min-width: 0; }
.workbench__main { position: relative; display: flex; flex-direction: column; height: 100%; min-width: 0; overflow: hidden; }
</style>