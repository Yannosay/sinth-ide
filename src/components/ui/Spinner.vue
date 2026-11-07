<script setup lang="ts">
withDefaults(defineProps<{ size?: number; thickness?: number; label?: string }>(), {
  size: 14,
  thickness: 2,
  label: 'Loading'
})
</script>

<template>
  <span class="spinner" role="status" :aria-label="label">
    <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" :stroke-width="thickness">
      <circle cx="12" cy="12" r="10" stroke="currentColor" opacity="0.2" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-linecap="round" />
    </svg>
  </span>
</template>

<style scoped>
.spinner { display: inline-flex; align-items: center; justify-content: center; color: currentColor; }
.spinner svg { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>