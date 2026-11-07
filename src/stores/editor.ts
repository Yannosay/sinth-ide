import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface EditorTab {
  id: string
  path: string
  name: string
  language: string
  content: string
  originalContent: string
  dirty: boolean
  readonly: boolean
  encoding: string
  lineEnding: 'lf' | 'crlf'
}

let counter = 0
function nextId(): string {
  counter += 1
  return `tab-${counter}`
}

const LANGUAGE_MAP: ReadonlyArray<readonly [string, string]> = [
  ['.sinth', 'sinth'],
  ['.ts', 'typescript'], ['.tsx', 'typescript'], ['.mts', 'typescript'], ['.cts', 'typescript'],
  ['.js', 'javascript'], ['.mjs', 'javascript'], ['.cjs', 'javascript'], ['.jsx', 'javascript'],
  ['.json', 'json'],
  ['.html', 'html'], ['.htm', 'html'],
  ['.css', 'css'],
  ['.scss', 'scss'], ['.sass', 'scss'],
  ['.md', 'markdown'], ['.markdown', 'markdown'],
  ['.rs', 'rust'],
  ['.toml', 'ini'],
  ['.yaml', 'yaml'], ['.yml', 'yaml'],
  ['.xml', 'xml'],
  ['.sh', 'shell'], ['.bash', 'shell'], ['.zsh', 'shell'],
  ['.ps1', 'powershell'],
  ['.py', 'python']
]

export function languageForPath(path: string): string {
  const lower = path.toLowerCase()
  for (const [ext, lang] of LANGUAGE_MAP) if (lower.endsWith(ext)) return lang
  return 'plaintext'
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

export function detectLineEnding(content: string): 'lf' | 'crlf' {
  return content.includes('\r\n') ? 'crlf' : 'lf'
}

export const useEditorStore = defineStore('editor', () => {
  const tabs = ref<EditorTab[]>([])
  const activeTabId = ref<string | null>(null)
  const cursorLine = ref(1)
  const cursorColumn = ref(1)
  const selectionLength = ref(0)

  const activeTab = computed<EditorTab | null>(() => tabs.value.find(t => t.id === activeTabId.value) ?? null)

  function openFile(path: string, content: string, readonly = false): EditorTab {
    const existing = tabs.value.find(t => t.path === path)
    if (existing) { activeTabId.value = existing.id; return existing }
    const tab: EditorTab = {
      id: nextId(),
      path,
      name: basename(path),
      language: languageForPath(path),
      content,
      originalContent: content,
      dirty: false,
      readonly,
      encoding: 'utf-8',
      lineEnding: detectLineEnding(content)
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  function closeTab(id: string): void {
    const idx = tabs.value.findIndex(t => t.id === id)
    if (idx < 0) return
    tabs.value.splice(idx, 1)
    if (activeTabId.value === id) {
      const next = tabs.value[idx] ?? tabs.value[idx - 1] ?? null
      activeTabId.value = next ? next.id : null
    }
  }

  function closeAll(): void {
    tabs.value = []
    activeTabId.value = null
  }

  function setActive(id: string): void {
    if (tabs.value.some(t => t.id === id)) activeTabId.value = id
  }

  function updateContent(id: string, content: string): void {
    const tab = tabs.value.find(t => t.id === id)
    if (!tab || tab.readonly) return
    tab.content = content
    tab.dirty = content !== tab.originalContent
  }

  function markSaved(id: string, content: string): void {
    const tab = tabs.value.find(t => t.id === id)
    if (!tab) return
    tab.content = content
    tab.originalContent = content
    tab.dirty = false
  }

  return {
    tabs, activeTabId, activeTab, cursorLine, cursorColumn, selectionLength,
    openFile, closeTab, closeAll, setActive, updateContent, markSaved
  }
})