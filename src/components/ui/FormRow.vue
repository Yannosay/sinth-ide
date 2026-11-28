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
.form-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 0; }
.form-row__label { display: flex; flex-direction: column; gap: 3px; flex: 1 1 140px; min-width: 0; font-size: 11.5px; color: var(--fg); }
.form-row__hint { font-size: 10.5px; line-height: 1.5; color: var(--fg-subtle); }
.form-row__control { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex: 0 1 auto; min-width: 0; max-width: 100%; }
</style>