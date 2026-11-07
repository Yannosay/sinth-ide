<script setup lang="ts">
export type ActivityView = 'explorer' | 'compilers' | 'search' | 'settings'

const view = defineModel<ActivityView>('view', { required: true })

interface ActivityItem {
  id: ActivityView
  label: string
  shortcut: string
}

const items: ActivityItem[] = [
  { id: 'explorer', label: 'Explorer', shortcut: 'Ctrl+Shift+E' },
  { id: 'compilers', label: 'Compiler Versions', shortcut: 'Ctrl+Shift+C' },
  { id: 'search', label: 'Search', shortcut: 'Ctrl+Shift+F' }
]
</script>

<template>
  <aside class="activity">
    <div class="activity__group">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="activity__btn"
        :class="{ 'activity__btn--active': view === item.id }"
        :title="`${item.label} (${item.shortcut})`"
        @click="view = item.id"
      >
        <svg v-if="item.id === 'explorer'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
        <svg v-else-if="item.id === 'compilers'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="m16 18 6-6-6-6" />
          <path d="m8 6-6 6 6 6" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </div>
    <div class="activity__group activity__group--bottom">
      <button
        type="button"
        class="activity__btn"
        :class="{ 'activity__btn--active': view === 'settings' }"
        title="Settings (Ctrl+,)"
        @click="view = 'settings'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.34.41.62.75.75H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.activity { display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 48px; flex: 0 0 48px; background: var(--bg-1); border-right: 1px solid var(--border); padding: 6px 0; }
.activity__group { display: flex; flex-direction: column; gap: 4px; }
.activity__btn { position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); color: var(--fg-subtle); transition: background 80ms, color 80ms; }
.activity__btn:hover { background: var(--bg-2); color: var(--fg); }
.activity__btn--active { color: var(--accent); background: var(--accent-soft); }
.activity__btn--active::before { content: ''; position: absolute; left: -6px; top: 8px; bottom: 8px; width: 2px; background: var(--accent); border-radius: 2px; }
.activity__btn svg { width: 22px; height: 22px; }
</style>