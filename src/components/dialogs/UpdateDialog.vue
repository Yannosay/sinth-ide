<script setup lang="ts">
import { computed } from 'vue'
import { open as openUrl } from '@tauri-apps/plugin-shell'
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

type Inline = { code: boolean; text: string }
type Block = { kind: 'h' | 'p' | 'li'; parts: Inline[] }

function inline(text: string): Inline[] {
  return text.split(/(`[^`]+`)/).filter(Boolean).map(t => t.startsWith('`') && t.endsWith('`') && t.length > 1
    ? { code: true, text: t.slice(1, -1) }
    : { code: false, text: t.replace(/\*\*([^*]+)\*\*/g, '$1') })
}

/** Release notes are Markdown; headings, bullets and inline code are rendered as text nodes, never as HTML. */
const notes = computed<Block[]>(() => {
  const body = updater.releaseNotes ?? ''
  const blocks: Block[] = []
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^#{1,6}\s/.test(line)) blocks.push({ kind: 'h', parts: inline(line.replace(/^#+\s*/, '')) })
    else if (/^[-*]\s/.test(line)) blocks.push({ kind: 'li', parts: inline(line.slice(2)) })
    else blocks.push({ kind: 'p', parts: inline(line) })
  }
  return blocks
})

const published = computed(() => updater.publishedAt
  ? new Date(updater.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  : null)

function releasePage(): void {
  void openUrl(`https://github.com/Yannosay/sinth-ide/releases/tag/v${updater.availableVersion ?? ''}`)
}
</script>

<template>
  <Modal
    :open="visible"
    :title="updater.state === 'ready' ? 'Update installed' : `Sinth IDE ${updater.availableVersion ?? ''}`"
    :width="540"
    :close-on-backdrop="false"
    @update:open="v => { if (!v) updater.dismiss() }"
  >
    <div class="update">
      <p class="update__lead">
        You have {{ updater.currentVersion }}.<template v-if="published"> Released {{ published }}.</template>
      </p>
      <div v-if="notes.length" class="update__notes">
        <template v-for="(b, i) in notes" :key="i">
          <h4 v-if="b.kind === 'h'" class="update__h"><template v-for="(p, j) in b.parts" :key="j"><code v-if="p.code">{{ p.text }}</code><template v-else>{{ p.text }}</template></template></h4>
          <p v-else-if="b.kind === 'p'" class="update__p"><template v-for="(p, j) in b.parts" :key="j"><code v-if="p.code">{{ p.text }}</code><template v-else>{{ p.text }}</template></template></p>
          <p v-else class="update__li"><template v-for="(p, j) in b.parts" :key="j"><code v-if="p.code">{{ p.text }}</code><template v-else>{{ p.text }}</template></template></p>
        </template>
      </div>
      <div v-if="updater.state === 'downloading'" class="update__progress">
        <div class="update__progress-head">
          <Spinner :size="14" />
          <span>Downloading {{ formatBytes(updater.downloadedBytes) }}<template v-if="updater.totalBytes"> of {{ formatBytes(updater.totalBytes) }}</template></span>
          <span class="update__progress-pct">{{ progressPercent }}%</span>
        </div>
        <div class="update__bar"><div class="update__fill" :style="{ width: progressPercent + '%' }" /></div>
      </div>
      <div v-if="updater.state === 'ready'" class="update__ready">
        Restart Sinth IDE to start using the new version. Open files and terminals close on restart.
      </div>
      <div v-if="updater.state === 'failed'" class="update__error">
        {{ updater.errorMessage ?? 'The update could not be installed.' }}
      </div>
    </div>
    <template #footer>
      <button class="btn btn--link" type="button" @click="releasePage">Release page</button>
      <span class="update__spacer" />
      <button v-if="updater.state === 'available'" class="btn btn--ghost" type="button" @click="updater.dismiss()">Later</button>
      <button v-if="updater.state === 'available'" class="btn btn--primary" type="button" @click="updater.downloadAndInstall()">Install update</button>
      <button v-if="updater.state === 'ready'" class="btn btn--ghost" type="button" @click="updater.dismiss()">Later</button>
      <button v-if="updater.state === 'ready'" class="btn btn--primary" type="button" @click="updater.restart()">Restart now</button>
      <button v-if="updater.state === 'failed'" class="btn btn--ghost" type="button" @click="updater.dismiss()">Close</button>
      <button v-if="updater.state === 'failed'" class="btn btn--primary" type="button" @click="updater.downloadAndInstall()">Try again</button>
    </template>
  </Modal>
</template>

<style scoped>
.update { display: flex; flex-direction: column; gap: 16px; }
.update__lead { margin: 0; font-size: 12px; color: var(--fg-muted); }
.update__notes { display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow: auto; padding: 14px 16px; background: var(--bg-0); border: 1px solid var(--border); border-radius: var(--radius-md); user-select: text; }
.update__h { margin: 6px 0 2px; font-size: 12px; font-weight: 500; color: var(--fg); }
.update__h:first-child { margin-top: 0; }
.update__p, .update__li { margin: 0; font-size: 11.5px; line-height: 1.65; color: var(--fg-muted); }
.update__li { position: relative; padding-left: 14px; }
.update__li::before { content: ''; position: absolute; left: 2px; top: 0.75em; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }
.update__notes code { font-family: var(--font-mono); font-size: 11px; color: var(--accent-hover); background: var(--accent-soft); padding: 1px 5px; border-radius: 4px; }
.update__progress { display: flex; flex-direction: column; gap: 8px; }
.update__progress-head { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--fg-muted); }
.update__progress-pct { margin-left: auto; font-family: var(--font-mono); color: var(--fg); }
.update__bar { height: 3px; background: var(--bg-3); border-radius: 2px; overflow: hidden; }
.update__fill { height: 100%; background: var(--accent); transition: width 200ms var(--ease); }
.update__ready { padding: 12px 14px; background: rgba(74, 222, 128, 0.08); border: 1px solid rgba(74, 222, 128, 0.25); border-radius: var(--radius-md); color: var(--success); font-size: 11.5px; line-height: 1.6; }
.update__error { padding: 12px 14px; background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.25); border-radius: var(--radius-md); color: var(--error); font-size: 11.5px; line-height: 1.6; user-select: text; }
.update__spacer { flex: 1; }
</style>
