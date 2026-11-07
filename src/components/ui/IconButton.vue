<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  active?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'ghost' | 'danger'
}>(), {
  active: false,
  disabled: false,
  size: 'md',
  variant: 'default'
})

const cls = computed(() => [
  'icon-button',
  `icon-button--${props.size}`,
  `icon-button--${props.variant}`,
  { 'icon-button--active': props.active, 'icon-button--disabled': props.disabled }
])
</script>

<template>
  <button type="button" :class="cls" :title="title" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.icon-button { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg-muted); transition: background 80ms, color 80ms; flex-shrink: 0; }
.icon-button:hover:not(:disabled) { background: var(--bg-3); color: var(--fg); }
.icon-button--active { background: var(--accent-soft); color: var(--accent); }
.icon-button--disabled, .icon-button:disabled { opacity: 0.4; cursor: not-allowed; }
.icon-button--sm { width: 22px; height: 22px; }
.icon-button--md { width: 28px; height: 28px; }
.icon-button--lg { width: 36px; height: 36px; }
.icon-button--ghost { background: transparent; }
.icon-button--ghost:hover:not(:disabled) { background: var(--bg-2); }
.icon-button--danger:hover:not(:disabled) { background: rgba(239, 68, 68, 0.14); color: var(--error); }
.icon-button :deep(svg) { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
.icon-button--lg :deep(svg) { width: 20px; height: 20px; }
</style>