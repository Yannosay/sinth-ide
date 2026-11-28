<script setup lang="ts">
import { useConfirmStore } from '@/stores/confirm'
import Modal from '@/components/ui/Modal.vue'

const confirm = useConfirmStore()
</script>

<template>
  <Modal
    :open="!!confirm.current"
    :title="confirm.current?.title"
    :width="440"
    @update:open="v => { if (!v && confirm.current) confirm.answer(confirm.current.cancel) }"
  >
    <p class="confirm__message">{{ confirm.current?.message }}</p>
    <template #footer>
      <button
        v-for="c in confirm.current?.choices ?? []"
        :key="c.id"
        type="button"
        class="btn"
        :class="`btn--${c.kind ?? 'ghost'}`"
        @click="confirm.answer(c.id)"
      >{{ c.label }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.confirm__message { margin: 0; font-size: 12px; line-height: 1.7; color: var(--fg-muted); user-select: text; }
</style>
