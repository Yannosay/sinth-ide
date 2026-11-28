<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{
  size: number
  direction?: 'horizontal' | 'vertical'
  min?: number
  max?: number
  dividerSize?: number
  inverted?: boolean
  /** Which side keeps `size`; the other side takes the remaining space. */
  fixed?: 'first' | 'second'
  /** Hides the second side (and the divider) without unmounting the first. */
  collapsed?: boolean
  /** Hides the first side (and the divider). */
  hideFirst?: boolean
}>(), {
  direction: 'horizontal',
  min: 0,
  max: 100000,
  dividerSize: 4,
  inverted: false,
  fixed: 'first',
  collapsed: false,
  hideFirst: false
})

const emit = defineEmits<{ (e: 'update:size', value: number): void }>()

const dragging = ref(false)
let startPos = 0
let startSize = 0

function onPointerDown(e: PointerEvent): void {
  dragging.value = true
  startPos = props.direction === 'horizontal' ? e.clientX : e.clientY
  startSize = props.size
  document.body.style.cursor = props.direction === 'horizontal' ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return
  const current = props.direction === 'horizontal' ? e.clientX : e.clientY
  const delta = props.inverted !== (props.fixed === 'second') ? startPos - current : current - startPos
  emit('update:size', Math.max(props.min, Math.min(props.max, startSize + delta)))
}

function onPointerUp(): void {
  dragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

const wrapperStyle = computed(() => ({ flexDirection: props.direction === 'horizontal' ? 'row' : 'column' } as const))
const fixedStyle = computed(() => props.direction === 'horizontal'
  ? { width: props.size + 'px', flex: `0 0 ${props.size}px` }
  : { height: props.size + 'px', flex: `0 0 ${props.size}px` })
const fluidStyle = computed(() => props.direction === 'horizontal'
  ? { flex: '1 1 0', minWidth: '0' }
  : { flex: '1 1 0', minHeight: '0' })
const firstStyle = computed(() => props.fixed === 'first' && !props.collapsed ? fixedStyle.value : fluidStyle.value)
const secondStyle = computed(() => props.fixed === 'second' && !props.hideFirst
  ? { ...fixedStyle.value, ...(props.direction === 'horizontal' ? { maxWidth: 'calc(100% - 320px)' } : { maxHeight: 'calc(100% - 120px)' }) }
  : fluidStyle.value)
</script>

<template>
  <div class="split" :style="wrapperStyle">
    <div v-if="!hideFirst" class="split__first" :style="firstStyle"><slot name="first" /></div>
    <div
      v-if="!collapsed && !hideFirst"
      class="split__divider"
      :class="{ 'split__divider--active': dragging }"
      :style="direction === 'horizontal'
        ? { width: dividerSize + 'px', cursor: 'col-resize' }
        : { height: dividerSize + 'px', cursor: 'row-resize' }"
      @pointerdown="onPointerDown"
    >
      <div class="split__divider-line" />
    </div>
    <div v-if="!collapsed" class="split__second" :style="secondStyle"><slot name="second" /></div>
  </div>
</template>

<style scoped>
.split { display: flex; width: 100%; height: 100%; min-width: 0; min-height: 0; }
.split__first, .split__second { position: relative; overflow: hidden; min-width: 0; min-height: 0; }
.split__divider { position: relative; display: flex; align-items: center; justify-content: center; background: transparent; flex: 0 0 auto; z-index: 2; transition: background 80ms; }
.split__divider:hover, .split__divider--active { background: var(--accent-soft); }
.split__divider-line { background: var(--border); transition: background 80ms; }
.split__divider:hover .split__divider-line, .split__divider--active .split__divider-line { background: var(--accent); }
.split__divider[style*="col-resize"] .split__divider-line { width: 1px; height: 100%; }
.split__divider[style*="row-resize"] .split__divider-line { height: 1px; width: 100%; }
</style>