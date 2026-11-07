<script setup lang="ts">
import { computed } from 'vue'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '@/stores/workspace'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useCompilersStore } from '@/stores/compilers'
import BrandMark from '@/components/chrome/BrandMark.vue'

const workspace = useWorkspaceStore()
const editor = useEditorStore()
const settings = useSettingsStore()
const compilers = useCompilersStore()

const recent = computed(() => settings.recentFolders.slice(0, 6))

async function openFolder(): Promise<void> {
  const picked = await openDialog({ directory: true, multiple: false })
  if (typeof picked !== 'string') return
  await workspace.openFolder(picked)
  settings.pushRecentFolder(picked)
}

async function openRecent(path: string): Promise<void> {
  try { await workspace.openFolder(path); settings.pushRecentFolder(path) }
  catch (err) { console.error('[welcome]', err) }
}

async function createStarter(): Promise<void> {
  const picked = await openDialog({ directory: true, multiple: false })
  if (typeof picked !== 'string') return
  const sep = picked.includes('\\') ? '\\' : '/'
  const starterPath = `${picked.replace(/[\\/]$/, '')}${sep}pages${sep}index.sinth`
  const content = 'page\n\ntitle = "Hello Sinth"\n\nvar str name = "World"\n\nMain {\n  Heading(level: 1) { "Hello, " + name + "!" }\n  Input(model: name, placeholder: "Your name")\n  Paragraph { "Run sinth dev in the terminal to preview this page." }\n}\n'
  try {
    await invoke('create_file', { path: starterPath, content })
    await workspace.openFolder(picked)
    settings.pushRecentFolder(picked)
    editor.openFile(starterPath, content)
    settings.pushRecentFile(starterPath)
  } catch (err) { console.error('[welcome]', err) }
}
</script>

<template>
  <div class="welcome">
    <div class="welcome__inner">
      <h1 class="welcome__brand">
        <BrandMark :size="56" label="IDE" />
      </h1>
      <div class="welcome__columns">
        <section class="welcome__col">
          <h2 class="welcome__section">Start</h2>
          <button class="welcome__action" type="button" @click="openFolder">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            <span>Open Folder</span>
            <kbd>Ctrl+Shift+O</kbd>
          </button>
          <button class="welcome__action" type="button" @click="createStarter">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>New Sinth page</span>
          </button>
        </section>
        <section class="welcome__col">
          <h2 class="welcome__section">Recent</h2>
          <div v-if="recent.length === 0" class="welcome__empty">No recent folders.</div>
          <button
            v-for="p in recent"
            :key="p"
            class="welcome__recent"
            type="button"
            @click="openRecent(p)"
          >
            <span class="welcome__recent-name truncate">{{ p.split(/[\\/]/).pop() }}</span>
            <span class="welcome__recent-path truncate">{{ p }}</span>
          </button>
        </section>
        <section class="welcome__col">
          <h2 class="welcome__section">Environment</h2>
          <div class="welcome__env">
            <div class="welcome__env-row">
              <span class="welcome__env-dot" :class="{ 'welcome__env-dot--ok': compilers.nodeAvailable }" />
              <span class="welcome__env-label">Node.js</span>
              <span class="welcome__env-value mono">{{ compilers.nodeVersion ?? 'not detected' }}</span>
            </div>
            <div class="welcome__env-row">
              <span class="welcome__env-dot" :class="{ 'welcome__env-dot--ok': !!compilers.activeVersion }" />
              <span class="welcome__env-label">Sinth compiler</span>
              <span class="welcome__env-value mono">{{ compilers.activeVersion ?? 'not installed' }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg-0); overflow: auto; }
.welcome__inner { width: 100%; max-width: 880px; padding: 48px 32px; }
.welcome__brand { margin: 0 0 44px; font-weight: inherit; }
.welcome__columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 32px; }
.welcome__col { display: flex; flex-direction: column; gap: 4px; }
.welcome__section { margin: 0 0 8px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); }
.welcome__action { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-md); color: var(--fg); font-size: 13px; text-align: left; }
.welcome__action:hover { background: var(--bg-2); }
.welcome__action kbd { margin-left: auto; font-family: var(--font-mono); font-size: 10px; color: var(--fg-subtle); }
.welcome__recent { display: flex; flex-direction: column; gap: 2px; padding: 6px 10px; border-radius: var(--radius-md); text-align: left; }
.welcome__recent:hover { background: var(--bg-2); }
.welcome__recent-name { font-size: 13px; }
.welcome__recent-path { font-size: 11px; color: var(--fg-subtle); }
.welcome__empty { padding: 6px 10px; font-size: 12px; color: var(--fg-subtle); }
.welcome__env { display: flex; flex-direction: column; gap: 6px; }
.welcome__env-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--radius-md); background: var(--bg-2); font-size: 12px; }
.welcome__env-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--error); flex-shrink: 0; }
.welcome__env-dot--ok { background: var(--success); }
.welcome__env-label { flex: 1; }
.welcome__env-value { font-family: var(--font-mono); font-size: 11px; color: var(--fg-muted); }
.mono { font-family: var(--font-mono); }
</style>