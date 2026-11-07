<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCompilersStore, type CompilerVersion, type InstalledCompiler } from '@/stores/compilers'
import IconButton from '@/components/ui/IconButton.vue'
import Spinner from '@/components/ui/Spinner.vue'
import Modal from '@/components/ui/Modal.vue'

const compilers = useCompilersStore()
const confirmUninstall = ref<string | null>(null)
const installTarget = ref<CompilerVersion | null>(null)

onMounted(() => { void compilers.refreshAvailable() })

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return iso }
}

function progressPercent(): number {
  const p = compilers.progress
  if (!p || !p.bytesTotal) return 0
  return Math.min(100, Math.round((p.bytesReceived / p.bytesTotal) * 100))
}

function isInstalled(v: string): boolean { return compilers.installed.some(i => i.version === v) }
function isActive(v: string): boolean { return compilers.activeVersion === v }

async function doInstall(v: CompilerVersion): Promise<void> {
  installTarget.value = v
  try { await compilers.install(v.version) }
  catch (err) { console.error('[compilers]', err) }
  finally { installTarget.value = null }
}

async function doUninstall(v: InstalledCompiler): Promise<void> {
  try { await compilers.uninstall(v.version) }
  catch (err) { console.error('[compilers]', err) }
  finally { confirmUninstall.value = null }
}

async function doActivate(v: InstalledCompiler): Promise<void> {
  try { await compilers.activate(v.version) }
  catch (err) { console.error('[compilers]', err) }
}
</script>

<template>
  <div class="panel">
    <header class="panel__header">
      <span class="panel__title">Compiler Versions</span>
      <div class="panel__actions">
        <IconButton title="Refresh registry" size="sm" :disabled="compilers.loadingAvailable" @click="compilers.refreshAvailable(true)">
          <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
        </IconButton>
      </div>
    </header>
    <div class="panel__body">
      <section class="section">
        <div class="section__head"><span>Runtime</span></div>
        <div class="runtime" :class="{ 'runtime--ok': compilers.nodeAvailable }">
          <span class="runtime__dot" />
          <div class="runtime__info">
            <span class="runtime__label">{{ compilers.nodeAvailable ? `Node.js ${compilers.nodeVersion ?? ''}` : 'Node.js not detected' }}</span>
            <span class="runtime__path truncate">{{ compilers.nodePath ?? 'Install Node.js and restart Sinth IDE' }}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section__head"><span>Installed</span><span class="section__count">{{ compilers.installed.length }}</span></div>
        <div v-if="compilers.loadingInstalled" class="loading"><Spinner :size="14" /></div>
        <div v-else-if="compilers.installed.length === 0" class="empty">
          <p>No compiler versions installed.</p>
          <p class="empty__hint">Install one below to enable sinth commands in the terminal.</p>
        </div>
        <ul v-else class="list">
          <li v-for="i in compilers.installed" :key="i.version" class="list__item" :class="{ 'list__item--active': i.active }">
            <div class="list__main">
              <span class="list__badge" :class="{ 'list__badge--active': i.active }">{{ i.active ? 'Active' : 'Idle' }}</span>
              <span class="list__version">v{{ i.version }}</span>
              <span class="list__meta">{{ formatBytes(i.sizeBytes) }}</span>
            </div>
            <div class="list__actions">
              <button v-if="!i.active" class="btn btn--ghost" type="button" @click="doActivate(i)">Switch</button>
              <button class="btn btn--danger" type="button" :disabled="i.active" :title="i.active ? 'Switch to another version before removing' : 'Remove'" @click="confirmUninstall = i.version">Remove</button>
            </div>
          </li>
        </ul>
      </section>

      <section class="section">
        <div class="section__head"><span>Registry</span><span class="section__count">{{ compilers.available.length }}</span></div>
        <div v-if="compilers.loadingAvailable" class="loading"><Spinner :size="14" /></div>
        <div v-else-if="compilers.available.length === 0" class="empty">
          <p>Unable to reach the npm registry.</p>
          <p class="empty__hint">{{ compilers.lastError ?? 'Check your network connection.' }}</p>
        </div>
        <ul v-else class="list">
          <li v-for="v in compilers.available" :key="v.version" class="list__item">
            <div class="list__main">
              <span class="list__version">v{{ v.version }}</span>
              <span class="list__meta">{{ formatDate(v.publishedAt) }}</span>
              <span v-if="v.deprecated" class="list__deprecated">deprecated</span>
            </div>
            <div class="list__actions">
              <Spinner v-if="installTarget?.version === v.version" :size="14" />
              <button v-else-if="!isInstalled(v.version)" class="btn btn--primary" type="button" @click="doInstall(v)">Install</button>
              <span v-else-if="isActive(v.version)" class="list__tag">In use</span>
              <button v-else class="btn btn--ghost" type="button" @click="compilers.activate(v.version)">Switch to</button>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="compilers.progress" class="progress">
        <div class="progress__head">
          <span class="progress__label">{{ compilers.progress.message }}</span>
          <span v-if="compilers.progress.bytesTotal" class="progress__pct">{{ progressPercent() }}%</span>
        </div>
        <div class="progress__bar"><div class="progress__fill" :style="{ width: progressPercent() + '%' }" /></div>
      </section>
    </div>

    <Modal :open="confirmUninstall !== null" title="Remove compiler version" :width="440" @update:open="(v: boolean) => { if (!v) confirmUninstall = null }">
      <p>Remove Sinth v{{ confirmUninstall }} from this machine?</p>
      <p class="modal-hint">The npm registry retains the version. You can reinstall it at any time.</p>
      <template #footer>
        <button class="btn btn--ghost" type="button" @click="confirmUninstall = null">Cancel</button>
        <button class="btn btn--danger" type="button" @click="() => { const v = compilers.installed.find(i => i.version === confirmUninstall); if (v) void doUninstall(v) }">Remove</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; height: 100%; background: var(--bg-1); }
.panel__header { display: flex; align-items: center; justify-content: space-between; height: 32px; flex: 0 0 32px; padding: 0 8px 0 12px; border-bottom: 1px solid var(--border); }
.panel__title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); }
.panel__actions { display: flex; gap: 2px; }
.panel__body { flex: 1; overflow: auto; min-height: 0; padding: 12px; }
.section + .section { margin-top: 20px; }
.section__head { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); }
.section__count { background: var(--bg-3); padding: 1px 6px; border-radius: 8px; font-size: 10px; }
.runtime { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-md); }
.runtime__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--error); flex-shrink: 0; }
.runtime--ok .runtime__dot { background: var(--success); }
.runtime__info { display: flex; flex-direction: column; min-width: 0; }
.runtime__label { font-size: 12px; font-weight: 500; }
.runtime__path { font-size: 10px; color: var(--fg-subtle); font-family: var(--font-mono); }
.loading { display: flex; align-items: center; justify-content: center; padding: 24px; color: var(--fg-muted); }
.empty { padding: 16px 8px; text-align: center; color: var(--fg-muted); font-size: 12px; }
.empty__hint { margin-top: 4px; font-size: 11px; color: var(--fg-subtle); }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.list__item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-md); }
.list__item--active { border-color: var(--accent); background: var(--accent-soft); }
.list__main { display: flex; align-items: center; gap: 8px; min-width: 0; }
.list__version { font-family: var(--font-mono); font-size: 12px; font-weight: 500; }
.list__meta { font-size: 11px; color: var(--fg-subtle); }
.list__badge { font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 6px; border-radius: 8px; background: var(--bg-3); color: var(--fg-muted); }
.list__badge--active { background: var(--accent); color: var(--accent-fg); }
.list__deprecated { font-size: 10px; color: var(--warning); }
.list__tag { font-size: 11px; color: var(--accent); }
.list__actions { display: flex; gap: 6px; align-items: center; }
.btn { padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 500; transition: background 80ms; }
.btn--primary { background: var(--accent); color: var(--accent-fg); }
.btn--primary:hover { background: var(--accent-hover); }
.btn--ghost { background: var(--bg-3); color: var(--fg); }
.btn--ghost:hover { background: var(--border); }
.btn--danger { background: transparent; color: var(--error); border: 1px solid transparent; }
.btn--danger:hover:not(:disabled) { background: rgba(239, 68, 68, 0.12); }
.btn--danger:disabled { opacity: 0.4; cursor: not-allowed; }
.progress { margin-top: 16px; padding: 12px; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-md); }
.progress__head { display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-bottom: 8px; color: var(--fg-muted); }
.progress__label { color: var(--fg); }
.progress__pct { font-family: var(--font-mono); }
.progress__bar { height: 4px; background: var(--bg-3); border-radius: 2px; overflow: hidden; }
.progress__fill { height: 100%; background: var(--accent); transition: width 200ms; }
.modal-hint { margin-top: 8px; font-size: 12px; color: var(--fg-muted); }
</style>