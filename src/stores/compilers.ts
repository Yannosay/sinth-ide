import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface CompilerVersion {
  version: string
  tarballUrl: string
  shasum: string
  publishedAt: string
  description: string
  deprecated: boolean
}

export interface InstalledCompiler {
  version: string
  path: string
  installedAt: string
  sizeBytes: number
  active: boolean
}

export type InstallStage = 'resolving' | 'downloading' | 'verifying' | 'extracting' | 'dependencies' | 'registering' | 'done' | 'error'

export interface InstallProgress {
  version: string
  stage: InstallStage
  bytesReceived: number
  bytesTotal: number
  message: string
}

/** True when version `a` is older than `b` (plain x.y.z, pre-release tags ignored). */
export function isOlder(a: string, b: string): boolean {
  const pa = a.split('-')[0].split('.').map(Number)
  const pb = b.split('-')[0].split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x !== y) return x < y
  }
  return false
}

export const useCompilersStore = defineStore('compilers', () => {
  const available = ref<CompilerVersion[]>([])
  const installed = ref<InstalledCompiler[]>([])
  const activeVersion = ref<string | null>(null)
  const loadingAvailable = ref(false)
  const loadingInstalled = ref(false)
  const progress = ref<InstallProgress | null>(null)
  const lastError = ref<string | null>(null)
  const nodeAvailable = ref(false)
  const nodeVersion = ref<string | null>(null)
  const nodePath = ref<string | null>(null)

  const hasAny = computed(() => installed.value.length > 0)
  /** Newest stable release on npm, once `refreshAvailable` has run. */
  const latestStable = computed(() => available.value.find(v => !v.deprecated && !v.version.includes('-'))?.version ?? null)

  async function bootstrap(): Promise<void> {
    await Promise.all([checkNode(), refreshInstalled()])
  }

  async function checkNode(): Promise<void> {
    try {
      const r = await invoke<{ available: boolean; version: string | null; path: string | null }>('check_node_runtime')
      nodeAvailable.value = r.available
      nodeVersion.value = r.version
      nodePath.value = r.path
    } catch {
      nodeAvailable.value = false
      nodeVersion.value = null
      nodePath.value = null
    }
  }

  async function refreshAvailable(force = false): Promise<void> {
    if (loadingAvailable.value) return
    if (!force && available.value.length > 0) return
    loadingAvailable.value = true
    lastError.value = null
    try { available.value = await invoke<CompilerVersion[]>('list_available_compilers') }
    catch (err) { lastError.value = String(err) }
    finally { loadingAvailable.value = false }
  }

  async function refreshInstalled(): Promise<void> {
    if (loadingInstalled.value) return
    loadingInstalled.value = true
    lastError.value = null
    try {
      const r = await invoke<{ installed: InstalledCompiler[]; active: string | null }>('list_installed_compilers')
      installed.value = r.installed
      activeVersion.value = r.active
    } catch (err) { lastError.value = String(err) }
    finally { loadingInstalled.value = false }
  }

  async function install(version: string): Promise<void> {
    lastError.value = null
    progress.value = { version, stage: 'resolving', bytesReceived: 0, bytesTotal: 0, message: 'Resolving version metadata' }
    try { await invoke('install_compiler', { version }); await refreshInstalled() }
    catch (err) { lastError.value = String(err); throw err }
  }

  /** Installs the newest stable release from npm and returns its version. */
  async function installLatest(): Promise<string> {
    await refreshAvailable(true)
    const latest = available.value.find(v => !v.deprecated && !v.version.includes('-'))
    if (!latest) throw new Error(lastError.value ?? 'No Sinth release found on npm')
    await install(latest.version)
    return latest.version
  }

  async function uninstall(version: string): Promise<void> {
    lastError.value = null
    try { await invoke('uninstall_compiler', { version }); await refreshInstalled() }
    catch (err) { lastError.value = String(err); throw err }
  }

  async function activate(version: string): Promise<void> {
    lastError.value = null
    try { await invoke('activate_compiler', { version }); await refreshInstalled() }
    catch (err) { lastError.value = String(err); throw err }
  }

  function applyProgress(p: InstallProgress): void { progress.value = p }
  function clearProgress(): void { progress.value = null }

  return {
    available, installed, activeVersion, loadingAvailable, loadingInstalled,
    progress, lastError, nodeAvailable, nodeVersion, nodePath, hasAny, latestStable,
    bootstrap, checkNode, refreshAvailable, refreshInstalled,
    install, installLatest, uninstall, activate, applyProgress, clearProgress
  }
})