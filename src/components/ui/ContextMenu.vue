<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

interface MenuItem {
  id: string
  label: string
  danger?: boolean
}

const props = defineProps<{
  x: number
  y: number
  items: MenuItem[]
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'close'): void
}>()

const menuRef = ref<HTMLDivElement | null>(null)
const posX = ref(props.x)
const posY = ref(props.y)

onMounted(() => {
  requestAnimationFrame(() => {
    const el = menuRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width - 8
    const maxY = window.innerHeight - rect.height - 8
    posX.value = Math.min(props.x, Math.max(8, maxX))
    posY.value = Math.min(props.y, Math.max(8, maxY))
  })
  window.addEventListener('keydown', onKey)
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('blur', close)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('blur', close)
})

function close(): void {
  emit('close')
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}

function onPointerDown(e: PointerEvent): void {
  const el = menuRef.value
  if (!el) return
  if (!el.contains(e.target as Node)) close()
}

function pick(id: string): void {
  emit('select', id)
  close()
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuRef"
      class="context-menu"
      :style="{ left: posX + 'px', top: posY + 'px' }"
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="context-menu__item"
        :class="{ 'context-menu__item--danger': item.danger }"
        @click="pick(item.id)"
      >
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 180px;
  padding: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.context-menu__item {
  text-align: left;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--fg);
  transition: background 80ms;
}

.context-menu__item:hover {
  background: var(--bg-3);
}

.context-menu__item--danger {
  color: var(--error);
}

.context-menu__item--danger:hover {
  background: rgba(239, 68, 68, 0.12);
}
</style>