<script setup lang="ts">
import { useSettingsStore, type ThemeName } from '@/stores/settings'
import { useUpdaterStore } from '@/stores/updater'
import { platformShortcut } from '@/composables/useShortcutRouter'
import Select from '@/components/ui/Select.vue'
import Toggle from '@/components/ui/Toggle.vue'
import FormRow from '@/components/ui/FormRow.vue'

const settings = useSettingsStore()
const updater = useUpdaterStore()

const themeOptions = [
  { value: 'dark', label: 'Sinth Dark' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'slate', label: 'Slate Teal' },
  { value: 'light', label: 'Light' }
]

const whitespaceOptions = [
  { value: 'none', label: 'None' },
  { value: 'boundary', label: 'Boundary' },
  { value: 'selection', label: 'Selection' },
  { value: 'all', label: 'All' }
]

function onThemeUpdate(v: string): void {
  settings.theme = v as ThemeName
}
</script>

<template>
  <div class="panel">
    <header class="panel__header"><span class="panel__title">Settings</span></header>
    <div class="panel__body">
      <section class="group">
        <h3 class="group__title">Appearance</h3>
        <FormRow label="Theme">
          <Select :model-value="settings.theme" :options="themeOptions" @update:model-value="onThemeUpdate" />
        </FormRow>
      </section>
      <section class="group">
        <h3 class="group__title">Editor</h3>
        <FormRow label="Font size">
          <input v-model.number="settings.editorFontSize" type="number" min="10" max="28" class="input input--sm">
          <span class="unit">px</span>
        </FormRow>
        <FormRow label="Font family" hint="Leave empty to use the default">
          <input v-model="settings.editorFontFamily" type="text" class="input" placeholder="JetBrains Mono">
        </FormRow>
        <FormRow label="Tab size">
          <input v-model.number="settings.editorTabSize" type="number" min="1" max="8" class="input input--sm">
        </FormRow>
        <FormRow label="Word wrap"><Toggle v-model="settings.editorWordWrap" /></FormRow>
        <FormRow label="Minimap"><Toggle v-model="settings.editorMinimap" /></FormRow>
        <FormRow label="Line numbers"><Toggle v-model="settings.editorLineNumbers" /></FormRow>
        <FormRow label="Render whitespace">
          <Select :model-value="settings.editorRenderWhitespace" :options="whitespaceOptions" @update:model-value="v => settings.editorRenderWhitespace = v as never" />
        </FormRow>
        <FormRow label="Bracket pair colorization"><Toggle v-model="settings.editorBracketPairColorization" /></FormRow>
      </section>
      <section class="group">
        <h3 class="group__title">Terminal</h3>
        <FormRow label="Font size">
          <input v-model.number="settings.terminalFontSize" type="number" min="10" max="24" class="input input--sm">
          <span class="unit">px</span>
        </FormRow>
        <FormRow label="Shell" hint="Empty uses the OS default">
          <input v-model="settings.terminalShell" type="text" class="input" placeholder="powershell.exe">
        </FormRow>
      </section>
      <section class="group">
        <h3 class="group__title">Updates</h3>
        <FormRow label="Check on startup"><Toggle v-model="settings.autoCheckUpdates" /></FormRow>
        <FormRow label="Check now">
          <button class="btn" type="button" :disabled="updater.state === 'checking'" @click="updater.checkForUpdate()">
            {{ updater.state === 'checking' ? 'Checking' : 'Check for updates' }}
          </button>
        </FormRow>
        <FormRow label="Current version" hint="Installed application version">
          <span class="mono">{{ updater.currentVersion ?? 'unknown' }}</span>
        </FormRow>
      </section>
      <section class="group">
        <h3 class="group__title">Window</h3>
        <FormRow label="Activity bar"><Toggle v-model="settings.activityBarVisible" /></FormRow>
        <FormRow label="Status bar"><Toggle v-model="settings.statusBarVisible" /></FormRow>
      </section>
      <section class="group">
        <h3 class="group__title">Keyboard</h3>
        <div class="shortcuts">
          <div class="shortcut"><span>Command Palette</span><kbd>{{ platformShortcut('Ctrl+Shift+P') }}</kbd></div>
          <div class="shortcut"><span>Quick Open</span><kbd>{{ platformShortcut('Ctrl+P') }}</kbd></div>
          <div class="shortcut"><span>Save</span><kbd>{{ platformShortcut('Ctrl+S') }}</kbd></div>
          <div class="shortcut"><span>Save All</span><kbd>{{ platformShortcut('Ctrl+Shift+S') }}</kbd></div>
          <div class="shortcut"><span>Open Folder</span><kbd>{{ platformShortcut('Ctrl+Shift+O') }}</kbd></div>
          <div class="shortcut"><span>Toggle Terminal</span><kbd>{{ platformShortcut('Ctrl+`') }}</kbd></div>
          <div class="shortcut"><span>New Terminal</span><kbd>{{ platformShortcut('Ctrl+Shift+`') }}</kbd></div>
          <div class="shortcut"><span>Toggle Sidebar</span><kbd>{{ platformShortcut('Ctrl+B') }}</kbd></div>
          <div class="shortcut"><span>Search in Folder</span><kbd>{{ platformShortcut('Ctrl+Shift+F') }}</kbd></div>
        </div>
      </section>
      <section class="group">
        <h3 class="group__title">Reset</h3>
        <button class="btn btn--danger" type="button" @click="settings.reset()">Reset all settings to defaults</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; height: 100%; background: var(--bg-1); }
.panel__header { display: flex; align-items: center; height: 32px; flex: 0 0 32px; padding: 0 12px; border-bottom: 1px solid var(--border); }
.panel__title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); }
.panel__body { flex: 1; overflow: auto; min-height: 0; padding: 12px; }
.group + .group { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border); }
.group__title { margin: 0 0 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-muted); }
.input { padding: 4px 8px; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--fg); font: inherit; font-size: 12px; width: 100%; max-width: 260px; }
.input:focus { outline: none; border-color: var(--accent); }
.input--sm { width: 64px; max-width: 64px; }
.unit { font-size: 11px; color: var(--fg-subtle); }
.shortcuts { display: flex; flex-direction: column; gap: 4px; }
.shortcut { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; font-size: 12px; }
.shortcut kbd { font-family: var(--font-mono); font-size: 11px; background: var(--bg-3); border: 1px solid var(--border); border-radius: 3px; padding: 1px 6px; color: var(--fg-muted); }
.btn { padding: 5px 12px; background: var(--bg-3); color: var(--fg); border-radius: var(--radius-sm); font-size: 11px; font-weight: 500; }
.btn:hover:not(:disabled) { background: var(--border); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--danger { background: transparent; color: var(--error); border: 1px solid var(--error); }
.btn--danger:hover { background: rgba(239, 68, 68, 0.1); }
.mono { font-family: var(--font-mono); font-size: 11px; color: var(--fg-muted); }
</style>