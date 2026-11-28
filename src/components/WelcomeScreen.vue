<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { open as openUrl } from '@tauri-apps/plugin-shell'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import { useCompilersStore } from '@/stores/compilers'
import { useProjectStore } from '@/stores/project'
import { useTasksStore } from '@/stores/tasks'
import { platformShortcut } from '@/composables/useShortcutRouter'
import BrandMark from '@/components/chrome/BrandMark.vue'
import Modal from '@/components/ui/Modal.vue'

const workspace = useWorkspaceStore()
const settings = useSettingsStore()
const compilers = useCompilersStore()
const project = useProjectStore()
const tasks = useTasksStore()

const recent = computed(() => settings.recentFolders.slice(0, 6))

type Template = 'starter' | 'minimal' | 'blank'
const templates: Array<{ id: Template; label: string; text: string }> = [
  { id: 'starter', label: 'Starter', text: 'Two pages, a layout and sinth:ui components.' },
  { id: 'minimal', label: 'Minimal', text: 'One page with a counter.' },
  { id: 'blank', label: 'Blank', text: 'Config and folders only.' },
]

const createOpen = ref(false)
const name = ref('my-site')
const parent = ref<string | null>(null)
const template = ref<Template>('starter')
const createError = ref<string | null>(null)
const creatingDir = ref<string | null>(null)

const nameValid = computed(() => /^[A-Za-z0-9][\w.-]*$/.test(name.value.trim()))
const target = computed(() => parent.value ? joinPath(parent.value, name.value.trim()) : null)

function joinPath(base: string, child: string): string {
  const sep = base.includes('\\') ? '\\' : '/'
  return base.replace(/[\\/]+$/, '') + sep + child
}

async function openFolder(): Promise<void> {
  const picked = await openDialog({ directory: true, multiple: false })
  if (typeof picked !== 'string') return
  await workspace.openFolder(picked)
  settings.pushRecentFolder(picked)
}

async function openRecent(path: string): Promise<void> {
  try { await workspace.openFolder(path); settings.pushRecentFolder(path) }
  catch { settings.recentFolders = settings.recentFolders.filter(p => p !== path) }
}

async function chooseParent(): Promise<void> {
  const picked = await openDialog({ directory: true, multiple: false, title: 'Choose where to create the project' })
  if (typeof picked === 'string') parent.value = picked
}

function startCreate(): void {
  createError.value = null
  createOpen.value = true
}

async function create(): Promise<void> {
  if (!target.value || !nameValid.value) return
  createError.value = null
  await project.refreshCompiler(parent.value ?? undefined)
  creatingDir.value = target.value
  createOpen.value = false
  project.runAction(project.createAction(target.value, template.value))
}

// `sinth create` runs in a terminal task; once it exits, open the project if it was written.
watch(() => tasks.byAction('create'), async (now, before) => {
  if (now || !before || !creatingDir.value) return
  const dir = creatingDir.value
  creatingDir.value = null
  try {
    await invoke<string>('read_text_file', { path: joinPath(dir, 'sinth.config.json') })
    await workspace.openFolder(dir)
    settings.pushRecentFolder(dir)
  } catch {
    createError.value = 'The project was not created. The terminal shows what went wrong.'
    createOpen.value = true
  }
})
</script>

<template>
  <div class="welcome">
    <div class="welcome__inner">
      <header class="welcome__head">
        <BrandMark :size="40" />
        <h1 class="welcome__title">Sinth IDE</h1>
        <p class="welcome__lead">Write a page, press Run, and see it beside your code. Checks, builds and deploys are one click away.</p>
      </header>

      <div class="welcome__grid">
        <section class="welcome__col">
          <h2 class="welcome__section">Start</h2>
          <button class="welcome__action" type="button" @click="startCreate">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            <span>New project</span>
          </button>
          <button class="welcome__action" type="button" @click="openFolder">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
            <span>Open folder</span>
            <kbd class="kbd">{{ platformShortcut('Ctrl+Shift+O') }}</kbd>
          </button>
          <button class="welcome__action" type="button" @click="openUrl('https://sinth.yannosay.com/docs')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z" /><path d="M4 17a2 2 0 0 1 2-2h12" /></svg>
            <span>Documentation</span>
          </button>
        </section>

        <section class="welcome__col">
          <h2 class="welcome__section">Recent</h2>
          <p v-if="recent.length === 0" class="welcome__empty">Folders you open show up here.</p>
          <button v-for="p in recent" :key="p" class="welcome__recent" type="button" :title="p" @click="openRecent(p)">
            <span class="welcome__recent-name truncate">{{ p.split(/[\\/]/).pop() }}</span>
            <span class="welcome__recent-path truncate">{{ p }}</span>
          </button>
        </section>
      </div>

      <footer class="welcome__env">
        <span class="welcome__env-item"><span class="dot" :class="{ 'dot--ok': compilers.nodeAvailable }" />Node.js {{ compilers.nodeVersion ?? 'not found' }}</span>
        <span class="welcome__env-item"><span class="dot" :class="{ 'dot--ok': !!compilers.activeVersion }" />Sinth {{ compilers.activeVersion ?? 'from npm on first run' }}</span>
        <button v-if="!compilers.nodeAvailable" class="btn btn--link welcome__node" type="button" @click="openUrl('https://nodejs.org/en/download')">Install Node.js 18+</button>
      </footer>
    </div>

    <Modal v-model:open="createOpen" title="New Sinth project" :width="480">
      <form class="create" @submit.prevent="create">
        <label class="create__field">
          <span>Name</span>
          <input v-model="name" class="create__input" spellcheck="false" autocomplete="off" :aria-invalid="!nameValid">
        </label>
        <div class="create__field">
          <span>Location</span>
          <button class="create__input create__picker" type="button" @click="chooseParent">
            <span class="truncate">{{ parent ?? 'Choose a folder' }}</span>
          </button>
        </div>
        <fieldset class="create__templates">
          <legend>Template</legend>
          <label v-for="t in templates" :key="t.id" class="create__template" :class="{ 'create__template--on': template === t.id }">
            <input v-model="template" type="radio" name="template" :value="t.id">
            <span class="create__template-label">{{ t.label }}</span>
            <span class="create__template-text">{{ t.text }}</span>
          </label>
        </fieldset>
        <p v-if="target" class="create__target">Creates <span class="mono">{{ target }}</span></p>
        <p v-if="createError" class="create__error">{{ createError }}</p>
      </form>
      <template #footer>
        <button class="btn btn--ghost" type="button" @click="createOpen = false">Cancel</button>
        <button class="btn btn--primary" type="button" :disabled="!target || !nameValid" @click="create">Create project</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.welcome { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg-0); overflow: auto; }
.welcome__inner { width: 100%; max-width: 760px; padding: 56px 40px; }
.welcome__head { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; margin-bottom: 48px; }
.welcome__title { margin: 6px 0 0; font-family: var(--font-brand); font-size: 30px; font-weight: 500; letter-spacing: -0.02em; color: var(--fg); }
.welcome__lead { margin: 0; max-width: 460px; font-size: 13px; line-height: 1.7; color: var(--fg-muted); }
.welcome__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 40px; }
.welcome__col { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.welcome__section { margin: 0 0 10px; font-size: 12px; font-weight: 500; color: var(--fg); }
.welcome__action { display: flex; align-items: center; gap: 12px; height: 36px; padding: 0 10px; margin-left: -10px; border-radius: var(--radius-sm); color: var(--fg-muted); font-size: 12px; text-align: left; transition: background 120ms var(--ease), color 120ms var(--ease); }
.welcome__action:hover { background: var(--bg-2); color: var(--fg); }
.welcome__action svg { color: var(--accent); }
.welcome__action .kbd { margin-left: auto; }
.welcome__recent { display: flex; flex-direction: column; gap: 3px; padding: 7px 10px; margin-left: -10px; border-radius: var(--radius-sm); text-align: left; min-width: 0; }
.welcome__recent:hover { background: var(--bg-2); }
.welcome__recent-name { font-size: 12px; color: var(--fg); }
.welcome__recent-path { font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-subtle); }
.welcome__empty { margin: 0; font-size: 11.5px; color: var(--fg-subtle); }
.welcome__env { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--border); font-size: 11px; color: var(--fg-subtle); }
.welcome__env-item { display: inline-flex; align-items: center; gap: 8px; }
.welcome__node { height: 22px; color: var(--accent); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--error); }
.dot--ok { background: var(--success); }
.create { display: flex; flex-direction: column; gap: 14px; }
.create__field { display: flex; flex-direction: column; gap: 6px; font-size: 11.5px; color: var(--fg-muted); }
.create__input { height: 32px; padding: 0 10px; background: var(--bg-0); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); color: var(--fg); font: inherit; font-size: 12px; outline: none; }
.create__input:focus { border-color: var(--accent); }
.create__input[aria-invalid='true'] { border-color: var(--error); }
.create__picker { display: flex; align-items: center; text-align: left; color: var(--fg-muted); }
.create__picker:hover { color: var(--fg); }
.create__templates { display: grid; gap: 6px; margin: 0; padding: 0; border: 0; }
.create__templates legend { margin-bottom: 6px; font-size: 11.5px; color: var(--fg-muted); }
.create__template { display: grid; grid-template-columns: 76px 1fr; align-items: baseline; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; }
.create__template input { position: absolute; opacity: 0; pointer-events: none; }
.create__template--on { border-color: var(--accent); background: var(--accent-soft); }
.create__template:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }
.create__template-label { font-size: 12px; color: var(--fg); }
.create__template-text { font-size: 11px; color: var(--fg-muted); }
.create__target { margin: 0; font-size: 11px; color: var(--fg-subtle); word-break: break-all; }
.create__target .mono { color: var(--fg-muted); }
.create__error { margin: 0; font-size: 11.5px; color: var(--error); }
</style>
