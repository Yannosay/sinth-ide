<script setup lang="ts">
import { computed } from 'vue'
import { fileIconUrl, folderIconUrl } from '@/lib/fileIcons'

const props = withDefaults(defineProps<{ name: string; folder?: boolean; open?: boolean; size?: number }>(), { folder: false, open: false, size: 16 })

const src = computed(() => (props.folder ? folderIconUrl(props.name, props.open) : fileIconUrl(props.name)))
</script>

<template>
  <img class="file-icon" :src="src" :width="size" :height="size" alt="" draggable="false" />
</template>

<style scoped>
.file-icon { flex-shrink: 0; object-fit: contain; user-select: none; pointer-events: none; }
</style>
