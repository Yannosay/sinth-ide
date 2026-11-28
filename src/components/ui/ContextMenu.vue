<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

interface MenuItem {
  id: string
  label: string
  danger?: boolean
  /** Secondary text on the right, such as a path or shortcut. */
  hint?: string
  /** Draws a divider above the item. */
  separator?: boolean
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
      role="menu"
      :style="{ left: posX + 'px', top: posY + 'px' }"
    >
      <template v-for="item in items" :key="item.id">
        <div v-if="item.separator" class="context-menu__sep" role="separator" />
        <button
          type="button"
          role="menuitem"
          class="context-menu__item"
          :class="{ 'context-menu__item--danger': item.danger }"
          @click="pick(item.id)"
        >
          <span class="truncate">{{ item.label }}</span>
          <span v-if="item.hint" class="context-menu__hint truncate">{{ item.hint }}</span>
        </button>
      </template>
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

.context-menu__sep { height: 1px; margin: 4px 6px; background: var(--border); }

.context-menu__hint { margin-left: auto; padding-left: 16px; max-width: 220px; font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-subtle); }

.context-menu__item {
  display: flex;
  align-items: center;
  max-width: 420px;
  text-align: left;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 11.5px;
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