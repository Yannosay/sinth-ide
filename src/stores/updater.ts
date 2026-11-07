import { defineStore } from 'pinia'
import { ref } from 'vue'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useSettingsStore } from './settings'

export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

export const useUpdaterStore = defineStore('updater', () => {
  const state = ref<UpdateState>('idle')
  const handle = ref<Update | null>(null)
  const availableVersion = ref<string | null>(null)
  const currentVersion = ref<string | null>(null)
  const releaseNotes = ref<string | null>(null)
  const publishedAt = ref<string | null>(null)
  const downloadedBytes = ref(0)
  const totalBytes = ref(0)
  const errorMessage = ref<string | null>(null)
  const dismissed = ref(false)

  async function checkOnStartup(): Promise<void> {
    const settings = useSettingsStore()
    if (!settings.autoCheckUpdates) return
    setTimeout(() => { void checkForUpdate({ silent: true }) }, 3000)
  }

  async function checkForUpdate(opts: { silent?: boolean } = {}): Promise<void> {
    if (state.value === 'checking' || state.value === 'downloading') return
    errorMessage.value = null
    state.value = 'checking'
    try {
      const found = await check()
      if (!found) {
        state.value = 'idle'
        availableVersion.value = null
        releaseNotes.value = null
        return
      }
      handle.value = found
      availableVersion.value = found.version
      currentVersion.value = found.currentVersion
      releaseNotes.value = found.body ?? null
      publishedAt.value = found.date ?? null
      state.value = 'available'
      dismissed.value = false
    } catch (err) {
      state.value = 'error'
      errorMessage.value = String(err)
      if (!opts.silent) console.error('[updater]', err)
    }
  }

  async function downloadAndInstall(): Promise<void> {
    if (!handle.value) return
    state.value = 'downloading'
    downloadedBytes.value = 0
    totalBytes.value = 0
    try {
      await handle.value.downloadAndInstall(event => {
        if (event.event === 'Started') totalBytes.value = event.data.contentLength ?? 0
        else if (event.event === 'Progress') downloadedBytes.value += event.data.chunkLength
        else if (event.event === 'Finished') state.value = 'ready'
      })
      state.value = 'ready'
    } catch (err) {
      state.value = 'error'
      errorMessage.value = String(err)
      console.error('[updater]', err)
    }
  }

  async function restart(): Promise<void> { await relaunch() }
  function dismiss(): void { dismissed.value = true }
  function reopen(): void { dismissed.value = false }

  return {
    state, handle, availableVersion, currentVersion, releaseNotes, publishedAt,
    downloadedBytes, totalBytes, errorMessage, dismissed,
    checkOnStartup, checkForUpdate, downloadAndInstall, restart, dismiss, reopen
  }
})