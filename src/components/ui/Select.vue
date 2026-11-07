<script setup lang="ts">
const model = defineModel<string>('modelValue', { required: true })
defineProps<{ options: ReadonlyArray<{ value: string; label: string }>; disabled?: boolean }>()
</script>

<template>
  <div class="select">
    <select v-model="model" :disabled="disabled">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <svg class="select__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </div>
</template>

<style scoped>
.select { position: relative; display: inline-flex; width: 100%; }
.select select { width: 100%; appearance: none; -webkit-appearance: none; background: var(--bg-2); color: var(--fg); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 6px 28px 6px 10px; font: inherit; font-size: 12px; cursor: pointer; transition: border-color 80ms; }
.select select:hover { border-color: var(--border-strong); }
.select select:focus { outline: none; border-color: var(--accent); }
.select__chevron { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; pointer-events: none; color: var(--fg-muted); }
</style>