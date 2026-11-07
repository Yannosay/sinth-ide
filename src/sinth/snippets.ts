import type * as Monaco from 'monaco-editor'
import { SINTH_LANGUAGE_ID } from './constants'

interface SnippetDef {
  label: string
  body: string
  detail: string
}

const SNIPPETS: SnippetDef[] = [
  { label: 'page', detail: 'Page skeleton', body: 'page\n\ntitle = "${1:Title}"\ndescr = "${2:Description}"\n\nMain {\n  Heading(level: 1) { "${1:Title}" }\n  $0\n}\n' },
  { label: 'component', detail: 'Component with a slot and scoped style', body: 'component ${1:Name}(str ${2:title}) {\n  Div(class: "${3:box}") {\n    Heading(level: 3) { ${2:title} }\n    \\$slot\n  }\n\n  style {\n    .${3:box} {\n      padding: "1rem"\n    }\n  }\n}\n' },
  { label: 'function', detail: 'Typed function', body: 'function ${1:name}(${2:num value}) -> ${3:num} {\n  return ${0:value}\n}' },
  { label: 'if', detail: 'Conditional markup', body: 'if ${1:condition} {\n  $0\n} else {\n  \n}' },
  { label: 'for', detail: 'Keyed loop', body: 'for ${1:item}, ${2:index} in ${3:items} key ${1:item}.${4:id} {\n  $0\n}' },
  { label: 'counter', detail: 'Reactive counter', body: 'var num ${1:count} = 0\n\nButton(onClick: ${1:count} += 1) { "Clicked " + ${1:count} + " times" }' },
  { label: 'form', detail: 'Form with binding and submit', body: 'var str ${1:email} = ""\n\nfunction submit() {\n  $0\n}\n\nForm(onSubmit.prevent: submit()) {\n  Input(type: "email", model: ${1:email}, required)\n  SubmitButton { "Send" }\n}' },
  { label: 'fetch', detail: 'Load data on mount', body: 'var obj[] ${1:items} = []\nvar bool loading = true\n\nonMount {\n  const res = await fetch("${2:/api/items}")\n  ${1:items} = await res.json()\n  loading = false\n}' },
  { label: 'import-ui', detail: 'Import sinth:ui components', body: 'import { ${1:Button, Card} } from "sinth:ui"' },
  { label: 'style', detail: 'Style block', body: 'style {\n  ${1:main} {\n    $0\n  }\n}' },
]

export function registerSinthSnippets(monaco: typeof Monaco): void {
  monaco.languages.registerCompletionItemProvider(SINTH_LANGUAGE_ID, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }
      return {
        suggestions: SNIPPETS.map(s => ({
          label: { label: s.label, description: 'snippet' },
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: s.body,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: s.detail,
          range,
          sortText: '~' + s.label,
        })),
      }
    },
  })
}
