<script setup lang="ts">
const model = defineModel<boolean>('modelValue', { required: true })
defineProps<{ disabled?: boolean }>()
</script>

<template>
  <button type="button" class="toggle" :class="{ 'toggle--on': model, 'toggle--disabled': disabled }" :disabled="disabled" :aria-pressed="model" @click="model = !model">
    <span class="toggle__knob" />
  </button>
</template>

<style scoped>
.toggle { position: relative; width: 32px; height: 18px; border-radius: 999px; background: var(--bg-3); border: 1px solid var(--border); transition: background 120ms, border-color 120ms; flex-shrink: 0; }
.toggle--on { background: var(--accent); border-color: var(--accent); }
.toggle--disabled { opacity: 0.4; cursor: not-allowed; }
.toggle__knob { position: absolute; top: 1px; left: 1px; width: 14px; height: 14px; border-radius: 50%; background: var(--fg); transition: transform 120ms, background 120ms; }
.toggle--on .toggle__knob { transform: translateX(14px); background: var(--accent-fg); }
</style>