<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, shallowRef } from 'vue'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { registerSinth, monacoThemeFor } from '@/sinth'
import { useEditorStore, type EditorTab } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useDiagnosticsStore } from '@/stores/diagnostics'

const props = defineProps<{ tab: EditorTab | null }>()

const container = ref<HTMLDivElement | null>(null)
const instance = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)
const settings = useSettingsStore()
const editor = useEditorStore()
const diagnostics = useDiagnosticsStore()

function applyMarkers(): void {
  const model = instance.value?.getModel()
  if (!model) return
  const path = props.tab?.path
  const markers = path ? diagnostics.forFile(path).map(d => {
    const line = d.loc?.line ?? 1
    const col = d.loc?.col ?? 1
    const safeLine = Math.min(Math.max(1, line), model.getLineCount())
    const word = model.getWordAtPosition({ lineNumber: safeLine, column: Math.min(col, model.getLineMaxColumn(safeLine)) })
    const end = Math.max(col + (d.loc?.length ?? 1), word?.endColumn ?? col + 1)
    return {
      severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      message: d.hint ? `${d.message}
${d.hint}` : d.message,
      code: d.code,
      source: 'sinth',
      startLineNumber: line,
      startColumn: col,
      endLineNumber: line,
      endColumn: end
    }
  }) : []
  monaco.editor.setModelMarkers(model, 'sinth', markers)
}

let workersReady = false
function setupWorkers(): void {
  if (workersReady) return
  workersReady = true
  ;(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      switch (label) {
        case 'json': return new jsonWorker()
        case 'css':
        case 'scss':
        case 'less': return new cssWorker()
        case 'html':
        case 'handlebars':
        case 'razor': return new htmlWorker()
        case 'typescript':
        case 'javascript': return new tsWorker()
        default: return new editorWorker()
      }
    }
  }
}

onMounted(() => {
  setupWorkers()
  registerSinth(monaco)
  if (!container.value) return

  instance.value = monaco.editor.create(container.value, {
    value: props.tab?.content ?? '',
    language: props.tab?.language ?? 'plaintext',
    theme: monacoThemeFor(settings.theme),
    automaticLayout: true,
    fontFamily: settings.editorFontFamily || 'JetBrains Mono, Cascadia Code, Consolas, monospace',
    fontSize: settings.editorFontSize,
    tabSize: settings.editorTabSize,
    wordWrap: settings.editorWordWrap ? 'on' : 'off',
    minimap: { enabled: settings.editorMinimap },
    lineNumbers: settings.editorLineNumbers ? 'on' : 'off',
    renderWhitespace: settings.editorRenderWhitespace,
    bracketPairColorization: { enabled: settings.editorBracketPairColorization },
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    padding: { top: 8, bottom: 8 },
    readOnly: props.tab?.readonly ?? false,
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false }
  })

  instance.value.onDidChangeModelContent(() => {
    if (!props.tab || !instance.value) return
    editor.updateContent(props.tab.id, instance.value.getValue())
  })

  instance.value.onDidChangeCursorPosition(e => {
    editor.cursorLine = e.position.lineNumber
    editor.cursorColumn = e.position.column
  })

  instance.value.onDidChangeCursorSelection(e => {
    editor.selectionLength = e.selection.isEmpty() ? 0 : instance.value?.getModel()?.getValueInRange(e.selection).length ?? 0
  })
})

onBeforeUnmount(() => {
  instance.value?.dispose()
  instance.value = null
})

watch(() => props.tab?.id, () => {
  if (!instance.value) return
  const model = instance.value.getModel()
  if (!model) return
  model.setValue(props.tab?.content ?? '')
  monaco.editor.setModelLanguage(model, props.tab?.language ?? 'plaintext')
  instance.value.updateOptions({ readOnly: props.tab?.readonly ?? false })
})

watch(() => props.tab?.content, next => {
  if (!instance.value) return
  const model = instance.value.getModel()
  if (!model) return
  if (model.getValue() !== next) model.setValue(next ?? '')
})

watch(() => settings.theme, t => monaco.editor.setTheme(monacoThemeFor(t)))
watch(() => [diagnostics.revision, props.tab?.path], applyMarkers)
watch(() => settings.editorFontSize, v => instance.value?.updateOptions({ fontSize: v }))
watch(() => settings.editorFontFamily, v => instance.value?.updateOptions({ fontFamily: v || 'JetBrains Mono, Cascadia Code, Consolas, monospace' }))
watch(() => settings.editorTabSize, v => instance.value?.updateOptions({ tabSize: v }))
watch(() => settings.editorWordWrap, v => instance.value?.updateOptions({ wordWrap: v ? 'on' : 'off' }))
watch(() => settings.editorMinimap, v => instance.value?.updateOptions({ minimap: { enabled: v } }))
watch(() => settings.editorLineNumbers, v => instance.value?.updateOptions({ lineNumbers: v ? 'on' : 'off' }))
watch(() => settings.editorRenderWhitespace, v => instance.value?.updateOptions({ renderWhitespace: v }))
watch(() => settings.editorBracketPairColorization, v => instance.value?.updateOptions({ bracketPairColorization: { enabled: v } }))

defineExpose({
  focus: () => instance.value?.focus(),
  reveal: () => instance.value?.revealLine(editor.cursorLine)
})
</script>

<template>
  <div ref="container" class="monaco-container" />
</template>

<style scoped>
.monaco-container { position: absolute; inset: 0; }
</style>