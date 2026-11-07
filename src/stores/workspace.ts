import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedMs: number
  hasChildren: boolean
  children: FileNode[] | null
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const rootPath = ref<string | null>(null)
  const tree = ref<FileNode[]>([])
  const expanded = ref<Set<string>>(new Set())
  const selected = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const rootName = computed(() => {
    if (!rootPath.value) return null
    const parts = rootPath.value.split(/[\\/]/)
    return parts[parts.length - 1] || rootPath.value
  })

  const selectedNode = computed<FileNode | null>(() => {
    if (!selected.value) return null
    return findNode(tree.value, selected.value)
  })

  function findNode(nodes: FileNode[], path: string): FileNode | null {
    for (const n of nodes) {
      if (n.path === path) return n
      if (n.children) {
        const hit = findNode(n.children, path)
        if (hit) return hit
      }
    }
    return null
  }

  async function openFolder(path: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await invoke<{ path: string; tree: FileNode[] }>('read_directory_tree', { path })
      rootPath.value = result.path
      tree.value = result.tree
      expanded.value = new Set([result.path])
      selected.value = null
    } catch (err) {
      error.value = String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function refresh(): Promise<void> {
    if (!rootPath.value) return
    await openFolder(rootPath.value)
  }

  async function reloadNode(path: string): Promise<void> {
    const node = findNode(tree.value, path)
    if (!node || !node.isDirectory) return
    try {
      node.children = await invoke<FileNode[]>('read_directory', { path })
      node.hasChildren = (node.children?.length ?? 0) > 0
    } catch (err) {
      console.error('[workspace] reload failed:', err)
    }
  }

  async function toggle(path: string): Promise<void> {
    const next = new Set(expanded.value)
    if (next.has(path)) next.delete(path)
    else {
      next.add(path)
      const node = findNode(tree.value, path)
      if (node && node.isDirectory && (!node.children || node.children.length === 0) && node.hasChildren) {
        try { node.children = await invoke<FileNode[]>('read_directory', { path }) }
        catch (err) { console.error('[workspace] toggle failed:', err) }
      }
    }
    expanded.value = next
  }

  function isExpanded(path: string): boolean { return expanded.value.has(path) }
  function select(path: string | null): void { selected.value = path }

  function parentDirectoryOf(path: string): string {
    const normalized = path.replace(/[\\/]+$/, '')
    const idx = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'))
    return idx > 0 ? normalized.slice(0, idx) : normalized
  }

  function joinPath(base: string, name: string): string {
    const sep = base.includes('\\') ? '\\' : '/'
    return base.replace(/[\\/]+$/, '') + sep + name
  }

  async function createFile(parentDir: string, name: string): Promise<string> {
    const full = joinPath(parentDir, name)
    await invoke('create_file', { path: full, content: '' })
    await reloadNode(parentDir)
    return full
  }

  async function createFolder(parentDir: string, name: string): Promise<string> {
    const full = joinPath(parentDir, name)
    await invoke('create_directory', { path: full })
    await reloadNode(parentDir)
    return full
  }

  async function rename(fromPath: string, newName: string): Promise<string> {
    const parent = parentDirectoryOf(fromPath)
    const full = joinPath(parent, newName)
    await invoke('rename_path', { from: fromPath, to: full })
    await reloadNode(parent)
    return full
  }

  async function remove(path: string): Promise<void> {
    const parent = parentDirectoryOf(path)
    await invoke('delete_path', { path })
    await reloadNode(parent)
    if (selected.value === path) selected.value = null
  }

  function close(): void {
    rootPath.value = null
    tree.value = []
    expanded.value = new Set()
    selected.value = null
    error.value = null
  }

  return {
    rootPath, rootName, tree, selected, selectedNode, loading, error,
    openFolder, refresh, reloadNode, toggle, isExpanded, select,
    createFile, createFolder, rename, remove, close,
    parentDirectoryOf, joinPath
  }
})