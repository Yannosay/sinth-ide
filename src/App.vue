<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useUpdaterStore } from '@/stores/updater'
import { useCompilersStore } from '@/stores/compilers'
import { useShortcutRouter } from '@/composables/useShortcutRouter'

const settings = useSettingsStore()
const updater = useUpdaterStore()
const compilers = useCompilersStore()

useShortcutRouter()

function applyTheme(): void {
  const html = document.documentElement
  const themes = ['theme-dark', 'theme-midnight', 'theme-slate', 'theme-light']
  for (const t of themes) html.classList.remove(t)
  html.classList.add(`theme-${settings.theme}`)
  if (settings.theme === 'light') html.classList.remove('dark')
  else html.classList.add('dark')
}

onMounted(async () => {
  await settings.load()
  applyTheme()
  void compilers.bootstrap()
  updater.checkOnStartup()
})

watch(() => settings.theme, applyTheme)
</script>

<template>
  <RouterView />
</template>