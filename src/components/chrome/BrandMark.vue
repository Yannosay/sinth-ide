<script setup lang="ts">
import logoUrl from '@/assets/sinth-logo.png'

withDefaults(defineProps<{ size?: number; label?: string }>(), { size: 24, label: '' })
</script>

<template>
  <span class="brand" :style="{ '--brand-size': `${size}px` }">
    <img class="brand__logo" :src="logoUrl" :width="size" :height="size" alt="Sinth" draggable="false" />
    <span v-if="label" class="brand__label">{{ label }}</span>
  </span>
</template>

<style scoped>
.brand { display: inline-flex; align-items: center; gap: calc(var(--brand-size) * 0.3); }
.brand__logo { width: var(--brand-size); height: var(--brand-size); object-fit: contain; flex-shrink: 0; }
.brand__label { font-family: var(--font-brand); font-weight: 500; font-size: calc(var(--brand-size) * 0.62); letter-spacing: 0.01em; color: var(--fg); line-height: 1; }
</style>
