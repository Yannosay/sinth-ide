<script setup lang="ts">
defineProps<{ label: string; hint?: string }>()
</script>

<template>
  <div class="form-row">
    <div class="form-row__label">
      <span>{{ label }}</span>
      <span v-if="hint" class="form-row__hint">{{ hint }}</span>
    </div>
    <div class="form-row__control"><slot /></div>
  </div>
</template>

<style scoped>
.form-row { display: grid; grid-template-columns: 180px 1fr; align-items: center; gap: 16px; padding: 8px 0; }
.form-row__label { display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
.form-row__hint { font-size: 11px; color: var(--fg-subtle); }
.form-row__control { display: flex; align-items: center; gap: 8px; }
</style>