<script setup lang="ts">
import { computed } from 'vue'
import { useUpdaterStore } from '@/stores/updater'
import Modal from '@/components/ui/Modal.vue'
import Spinner from '@/components/ui/Spinner.vue'

const updater = useUpdaterStore()

const visible = computed(() =>
  !updater.dismissed &&
  (updater.state === 'available' || updater.state === 'downloading' || updater.state === 'ready' || (updater.state === 'failed' && updater.failedDuring === 'download'))
)

const progressPercent = computed(() => {
  if (!updater.totalBytes) return 0
  return Math.min(100, Math.round((updater.downloadedBytes / updater.totalBytes) * 100))
})

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const releaseBody = computed(() => updater.releaseNotes ?? 'See the release page on GitHub for details.')
</script>

<template>
  <Modal
    :open="visible"
    :title="updater.state === 'ready' ? 'Update ready' : 'Update available'"
    :width="560"
    :close-on-backdrop="false"
    @update:open="v => { if (!v) updater.dismiss() }"
  >
    <div class="update">
      <div class="update__versions">
        <div class="update__badge">
          <span class="update__badge-label">Current</span>
          <span class="update__badge-value">{{ updater.currentVersion }}</span>
        </div>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="update__arrow">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
        <div class="update__badge update__badge--accent">
          <span class="update__badge-label">Available</span>
          <span class="update__badge-value">{{ updater.availableVersion }}</span>
        </div>
      </div>
      <div v-if="updater.publishedAt" class="update__date">
        Published {{ new Date(updater.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) }}
      </div>
      <div class="update__notes">
        <h4 class="update__notes-title">What's new</h4>
        <pre class="update__notes-body">{{ releaseBody }}</pre>
      </div>
      <div v-if="updater.state === 'downloading'" class="update__progress">
        <div class="update__progress-head">
          <Spinner :size="14" />
          <span>Downloading {{ formatBytes(updater.downloadedBytes) }} of {{ formatBytes(updater.totalBytes) }}</span>
          <span class="update__progress-pct">{{ progressPercent }}%</span>
        </div>
        <div class="update__bar"><div class="update__fill" :style="{ width: progressPercent + '%' }" /></div>
      </div>
      <div v-if="updater.state === 'ready'" class="update__ready">
        The update has been installed. Sinth IDE will restart to apply it.
      </div>
      <div v-if="updater.state === 'failed'" class="update__error">
        {{ updater.errorMessage ?? 'The update could not be installed.' }}
      </div>
    </div>
    <template #footer>
      <button v-if="updater.state === 'available'" class="btn btn--ghost" type="button" @click="updater.dismiss()">Later</button>
      <button v-if="updater.state === 'available'" class="btn btn--primary" type="button" @click="updater.downloadAndInstall()">Install and restart</button>
      <button v-if="updater.state === 'ready'" class="btn btn--primary" type="button" @click="updater.restart()">Restart now</button>
      <button v-if="updater.state === 'failed'" class="btn btn--ghost" type="button" @click="updater.dismiss()">Close</button>
    </template>
  </Modal>
</template>

<style scoped>
.update { display: flex; flex-direction: column; gap: 16px; }
.update__versions { display: flex; align-items: center; gap: 16px; }
.update__badge { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--bg-2); border: 1px solid var(--border); }
.update__badge--accent { border-color: var(--accent); background: var(--accent-soft); }
.update__badge-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-subtle); }
.update__badge-value { font-family: var(--font-mono); font-size: 14px; font-weight: 600; }
.update__arrow { color: var(--fg-muted); flex-shrink: 0; }
.update__date { font-size: 12px; color: var(--fg-muted); }
.update__notes { display: flex; flex-direction: column; gap: 6px; }
.update__notes-title { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); }
.update__notes-body { margin: 0; padding: 12px; max-height: 260px; overflow: auto; font-family: var(--font-ui); font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--fg); user-select: text; }
.update__progress { display: flex; flex-direction: column; gap: 8px; }
.update__progress-head { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--fg-muted); }
.update__progress-pct { margin-left: auto; font-family: var(--font-mono); color: var(--fg); }
.update__bar { height: 4px; background: var(--bg-3); border-radius: 2px; overflow: hidden; }
.update__fill { height: 100%; background: var(--accent); transition: width 200ms; }
.update__ready { padding: 12px; background: rgba(34, 197, 94, 0.10); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: var(--radius-md); color: var(--success); font-size: 12px; }
.update__error { padding: 12px; background: rgba(239, 68, 68, 0.10); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); color: var(--error); font-size: 12px; }
.btn { padding: 8px 16px; border-radius: var(--radius-md); font-size: 12px; font-weight: 500; transition: background 100ms; }
.btn--primary { background: var(--accent); color: var(--accent-fg); }
.btn--primary:hover { background: var(--accent-hover); }
.btn--ghost { background: var(--bg-3); color: var(--fg); }
.btn--ghost:hover { background: var(--border); }
</style>