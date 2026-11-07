import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useSettingsStore } from './settings'

/**
 * idle: nothing to show. upToDate: a check finished and this is the newest release.
 * available / downloading / ready: an update exists. failed: the last check or download failed.
 */
export type UpdateState = 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'ready' | 'failed'

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
  const failedDuring = ref<'check' | 'download' | null>(null)
  const lastChecked = ref<Date | null>(null)
  const dismissed = ref(false)

  void getVersion().then(v => { currentVersion.value = v }).catch(() => undefined)

  function checkOnStartup(): void {
    const settings = useSettingsStore()
    if (!settings.autoCheckUpdates) return
    setTimeout(() => { void checkForUpdate({ silent: true }) }, 4000)
  }

  async function checkForUpdate(opts: { silent?: boolean } = {}): Promise<void> {
    if (state.value === 'checking' || state.value === 'downloading') return
    errorMessage.value = null
    failedDuring.value = null
    state.value = 'checking'
    try {
      const found = await check({ timeout: 15000 })
      lastChecked.value = new Date()
      if (!found) {
        handle.value = null
        availableVersion.value = null
        releaseNotes.value = null
        state.value = 'upToDate'
        return
      }
      handle.value = found
      availableVersion.value = found.version
      currentVersion.value = found.currentVersion
      releaseNotes.value = found.body?.trim() || null
      publishedAt.value = found.date ?? null
      state.value = 'available'
      dismissed.value = false
    } catch (err) {
      lastChecked.value = new Date()
      // A failed check (offline, no release yet) is never presented as an available update.
      state.value = opts.silent ? 'idle' : 'failed'
      failedDuring.value = 'check'
      errorMessage.value = friendlyError(err)
    }
  }

  async function downloadAndInstall(): Promise<void> {
    if (!handle.value) return
    state.value = 'downloading'
    downloadedBytes.value = 0
    totalBytes.value = 0
    errorMessage.value = null
    try {
      await handle.value.downloadAndInstall(event => {
        if (event.event === 'Started') totalBytes.value = event.data.contentLength ?? 0
        else if (event.event === 'Progress') downloadedBytes.value += event.data.chunkLength
      })
      state.value = 'ready'
    } catch (err) {
      state.value = 'failed'
      failedDuring.value = 'download'
      errorMessage.value = friendlyError(err)
    }
  }

  function friendlyError(err: unknown): string {
    const text = String(err)
    if (/signature/i.test(text)) return 'The downloaded update is not signed by Yannosay Productions and was rejected.'
    if (/network|dns|connect|timed? ?out|offline/i.test(text)) return 'Could not reach GitHub. Check your internet connection.'
    if (/404|not found/i.test(text)) return 'No update information is published yet.'
    return text.replace(/^Error:\s*/, '')
  }

  async function restart(): Promise<void> { await relaunch() }
  function dismiss(): void { dismissed.value = true }
  function reopen(): void { dismissed.value = false }

  return {
    state, handle, availableVersion, currentVersion, releaseNotes, publishedAt,
    downloadedBytes, totalBytes, errorMessage, failedDuring, lastChecked, dismissed,
    checkOnStartup, checkForUpdate, downloadAndInstall, restart, dismiss, reopen
  }
})
