import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'sinth-ide:settings:v1'

export type ThemeName = 'dark' | 'midnight' | 'slate' | 'light'

export interface SettingsSnapshot {
  theme: ThemeName
  editorFontSize: number
  editorFontFamily: string
  editorTabSize: number
  editorWordWrap: boolean
  editorMinimap: boolean
  editorLineNumbers: boolean
  editorRenderWhitespace: 'none' | 'boundary' | 'selection' | 'all'
  editorBracketPairColorization: boolean
  terminalFontSize: number
  terminalShell: string
  autoCheckUpdates: boolean
  activityBarVisible: boolean
  statusBarVisible: boolean
  sidebarWidth: number
  terminalHeight: number
  recentFolders: string[]
  recentFiles: string[]
}

const DEFAULTS: SettingsSnapshot = {
  theme: 'dark',
  editorFontSize: 14,
  editorFontFamily: '',
  editorTabSize: 2,
  editorWordWrap: false,
  editorMinimap: true,
  editorLineNumbers: true,
  editorRenderWhitespace: 'selection',
  editorBracketPairColorization: true,
  terminalFontSize: 13,
  terminalShell: '',
  autoCheckUpdates: true,
  activityBarVisible: true,
  statusBarVisible: true,
  sidebarWidth: 280,
  terminalHeight: 240,
  recentFolders: [],
  recentFiles: []
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeName>(DEFAULTS.theme)
  const editorFontSize = ref(DEFAULTS.editorFontSize)
  const editorFontFamily = ref(DEFAULTS.editorFontFamily)
  const editorTabSize = ref(DEFAULTS.editorTabSize)
  const editorWordWrap = ref(DEFAULTS.editorWordWrap)
  const editorMinimap = ref(DEFAULTS.editorMinimap)
  const editorLineNumbers = ref(DEFAULTS.editorLineNumbers)
  const editorRenderWhitespace = ref(DEFAULTS.editorRenderWhitespace)
  const editorBracketPairColorization = ref(DEFAULTS.editorBracketPairColorization)
  const terminalFontSize = ref(DEFAULTS.terminalFontSize)
  const terminalShell = ref(DEFAULTS.terminalShell)
  const autoCheckUpdates = ref(DEFAULTS.autoCheckUpdates)
  const activityBarVisible = ref(DEFAULTS.activityBarVisible)
  const statusBarVisible = ref(DEFAULTS.statusBarVisible)
  const sidebarWidth = ref(DEFAULTS.sidebarWidth)
  const terminalHeight = ref(DEFAULTS.terminalHeight)
  const recentFolders = ref<string[]>(DEFAULTS.recentFolders)
  const recentFiles = ref<string[]>(DEFAULTS.recentFiles)

  let hydrated = false

  function snapshot(): SettingsSnapshot {
    return {
      theme: theme.value,
      editorFontSize: editorFontSize.value,
      editorFontFamily: editorFontFamily.value,
      editorTabSize: editorTabSize.value,
      editorWordWrap: editorWordWrap.value,
      editorMinimap: editorMinimap.value,
      editorLineNumbers: editorLineNumbers.value,
      editorRenderWhitespace: editorRenderWhitespace.value,
      editorBracketPairColorization: editorBracketPairColorization.value,
      terminalFontSize: terminalFontSize.value,
      terminalShell: terminalShell.value,
      autoCheckUpdates: autoCheckUpdates.value,
      activityBarVisible: activityBarVisible.value,
      statusBarVisible: statusBarVisible.value,
      sidebarWidth: sidebarWidth.value,
      terminalHeight: terminalHeight.value,
      recentFolders: recentFolders.value,
      recentFiles: recentFiles.value
    }
  }

  async function load(): Promise<void> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const p = JSON.parse(raw) as Partial<SettingsSnapshot>
      if (p.theme === 'dark' || p.theme === 'midnight' || p.theme === 'slate' || p.theme === 'light') theme.value = p.theme
      if (typeof p.editorFontSize === 'number') editorFontSize.value = p.editorFontSize
      if (typeof p.editorFontFamily === 'string') editorFontFamily.value = p.editorFontFamily
      if (typeof p.editorTabSize === 'number') editorTabSize.value = p.editorTabSize
      if (typeof p.editorWordWrap === 'boolean') editorWordWrap.value = p.editorWordWrap
      if (typeof p.editorMinimap === 'boolean') editorMinimap.value = p.editorMinimap
      if (typeof p.editorLineNumbers === 'boolean') editorLineNumbers.value = p.editorLineNumbers
      if (p.editorRenderWhitespace === 'none' || p.editorRenderWhitespace === 'boundary' || p.editorRenderWhitespace === 'selection' || p.editorRenderWhitespace === 'all') editorRenderWhitespace.value = p.editorRenderWhitespace
      if (typeof p.editorBracketPairColorization === 'boolean') editorBracketPairColorization.value = p.editorBracketPairColorization
      if (typeof p.terminalFontSize === 'number') terminalFontSize.value = p.terminalFontSize
      if (typeof p.terminalShell === 'string') terminalShell.value = p.terminalShell
      if (typeof p.autoCheckUpdates === 'boolean') autoCheckUpdates.value = p.autoCheckUpdates
      if (typeof p.activityBarVisible === 'boolean') activityBarVisible.value = p.activityBarVisible
      if (typeof p.statusBarVisible === 'boolean') statusBarVisible.value = p.statusBarVisible
      if (typeof p.sidebarWidth === 'number') sidebarWidth.value = p.sidebarWidth
      if (typeof p.terminalHeight === 'number') terminalHeight.value = p.terminalHeight
      if (Array.isArray(p.recentFolders)) recentFolders.value = p.recentFolders.filter(x => typeof x === 'string')
      if (Array.isArray(p.recentFiles)) recentFiles.value = p.recentFiles.filter(x => typeof x === 'string')
    } catch (err) {
      console.warn('[settings] load failed:', err)
    } finally {
      hydrated = true
    }
  }

  function reset(): void {
    theme.value = DEFAULTS.theme
    editorFontSize.value = DEFAULTS.editorFontSize
    editorFontFamily.value = DEFAULTS.editorFontFamily
    editorTabSize.value = DEFAULTS.editorTabSize
    editorWordWrap.value = DEFAULTS.editorWordWrap
    editorMinimap.value = DEFAULTS.editorMinimap
    editorLineNumbers.value = DEFAULTS.editorLineNumbers
    editorRenderWhitespace.value = DEFAULTS.editorRenderWhitespace
    editorBracketPairColorization.value = DEFAULTS.editorBracketPairColorization
    terminalFontSize.value = DEFAULTS.terminalFontSize
    terminalShell.value = DEFAULTS.terminalShell
    autoCheckUpdates.value = DEFAULTS.autoCheckUpdates
    activityBarVisible.value = DEFAULTS.activityBarVisible
    statusBarVisible.value = DEFAULTS.statusBarVisible
    sidebarWidth.value = DEFAULTS.sidebarWidth
    terminalHeight.value = DEFAULTS.terminalHeight
    recentFolders.value = []
    recentFiles.value = []
  }

  function pushRecentFolder(p: string): void {
    recentFolders.value = [p, ...recentFolders.value.filter(x => x !== p)].slice(0, 12)
  }

  function pushRecentFile(p: string): void {
    recentFiles.value = [p, ...recentFiles.value.filter(x => x !== p)].slice(0, 20)
  }

  watch(
    () => snapshot(),
    () => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())) },
    { deep: true }
  )

  return {
    theme, editorFontSize, editorFontFamily, editorTabSize, editorWordWrap,
    editorMinimap, editorLineNumbers, editorRenderWhitespace, editorBracketPairColorization,
    terminalFontSize, terminalShell, autoCheckUpdates,
    activityBarVisible, statusBarVisible, sidebarWidth, terminalHeight,
    recentFolders, recentFiles,
    load, reset, pushRecentFolder, pushRecentFile
  }
})