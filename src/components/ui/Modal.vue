<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  width?: number
  closeOnBackdrop?: boolean
}>(), {
  width: 560,
  closeOnBackdrop: true
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
}>()

const dialogEl = ref<HTMLDivElement | null>(null)

function close(): void {
  emit('update:open', false)
  emit('close')
}

function onBackdrop(e: MouseEvent): void {
  if (!props.closeOnBackdrop) return
  if (e.target === e.currentTarget) close()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) close()
}

watch(() => props.open, v => { if (v) requestAnimationFrame(() => dialogEl.value?.focus()) })

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="modal">
    <div v-if="open" class="modal" @mousedown="onBackdrop">
      <div ref="dialogEl" class="modal__dialog" :style="{ width: width + 'px', maxWidth: 'calc(100vw - 48px)' }" tabindex="-1" role="dialog" aria-modal="true">
        <header v-if="title || $slots.header" class="modal__header">
          <slot name="header"><h2 class="modal__title">{{ title }}</h2></slot>
          <button class="modal__close" type="button" aria-label="Close" @click="close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div class="modal__body"><slot /></div>
        <footer v-if="$slots.footer" class="modal__footer"><slot name="footer" /></footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal__dialog { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; max-height: calc(100vh - 80px); outline: none; }
.modal__header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
.modal__title { margin: 0; font-size: 15px; font-weight: 600; }
.modal__close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg-muted); transition: background 80ms, color 80ms; }
.modal__close:hover { background: var(--bg-3); color: var(--fg); }
.modal__body { padding: 20px; overflow: auto; flex: 1; min-height: 0; }
.modal__footer { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }
.modal-enter-active, .modal-leave-active { transition: opacity 140ms ease; }
.modal-enter-active .modal__dialog, .modal-leave-active .modal__dialog { transition: transform 140ms ease, opacity 140ms ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal__dialog, .modal-leave-to .modal__dialog { transform: scale(0.96); opacity: 0; }
</style>