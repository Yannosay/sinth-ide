import type * as Monaco from 'monaco-editor'
import {
  SINTH_DIRECTIVES, SINTH_ELEMENTS, SINTH_EVENT_MODIFIERS, SINTH_EVENTS, SINTH_KEYWORDS, SINTH_LANGUAGE_ID,
  SINTH_META_KEYS, SINTH_TYPES, SINTH_UI_COMPONENTS,
} from './constants'

const KEYWORD_DOCS: Readonly<Record<string, string>> = {
  var: 'Reactive variable: `var num count = 0`. Changing it updates the UI.',
  const: 'Constant value: `const str API = "https://..."`.',
  computed: 'Derived value that recalculates automatically: `computed num total = price * qty`.',
  persist: 'Saves the variable in localStorage: `persist var str theme = "dark"`.',
  component: 'Reusable UI: `component Card(str title) { ... }`.',
  function: 'Function with typed parameters: `function add(num a, num b) -> num { return a + b }`.',
  import: 'Imports components, stores, npm packages, CSS, JSON or fonts.',
  extern: 'Declares a browser global provided by an external script: `extern Chart`.',
  watch: 'Runs code when a value changes: `watch query { results = search(value) }`.',
  onMount: 'Runs once after the page or component is shown.',
  onDestroy: 'Runs when the component is removed.',
  bind: 'In component parameters, `bind value` makes the parameter two-way bindable.',
  $slot: 'Placeholder for the children passed to a component. Named: `$slot(name: "footer")`.',
}

function rangeAt(model: Monaco.editor.ITextModel, position: Monaco.Position): Monaco.IRange {
  const word = model.getWordUntilPosition(position)
  return { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }
}

function insideAttributeList(model: Monaco.editor.ITextModel, position: Monaco.Position): boolean {
  const text = model.getValueInRange({ startLineNumber: Math.max(1, position.lineNumber - 30), startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column })
  let depth = 0
  for (let i = text.length - 1; i >= 0; i--) {
    const c = text[i]
    if (c === ')') depth++
    else if (c === '(') {
      if (depth === 0) return /[A-Z][\w.]*\s*$/.test(text.slice(0, i))
      depth--
    } else if (c === '{' || c === '}') return false
  }
  return false
}

export function registerSinthProviders(monaco: typeof Monaco): void {
  const Kind = monaco.languages.CompletionItemKind
  const Snippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet

  monaco.languages.registerCompletionItemProvider(SINTH_LANGUAGE_ID, {
    triggerCharacters: ['(', ',', ' ', '.', '"'],
    provideCompletionItems(model, position) {
      const range = rangeAt(model, position)
      const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
      const suggestions: Monaco.languages.CompletionItem[] = []

      if (/^\s*import\s+[^"]*"[^"]*$/.test(before) || /from\s+"[^"]*$/.test(before)) {
        for (const lib of ['sinth:ui']) suggestions.push({ label: lib, kind: Kind.Module, insertText: lib, range, detail: 'Built-in Sinth library' })
        return { suggestions }
      }

      const modifier = before.match(/on[A-Z]\w*((?:\.\w+)*)\.(\w*)$/)
      if (modifier) {
        for (const m of SINTH_EVENT_MODIFIERS) suggestions.push({ label: m, kind: Kind.EnumMember, insertText: m, range, detail: 'event modifier' })
        return { suggestions }
      }

      if (insideAttributeList(model, position)) {
        for (const [name, doc] of Object.entries(SINTH_DIRECTIVES)) {
          suggestions.push({ label: name, kind: Kind.Property, insertText: `${name}: $0`, insertTextRules: Snippet, range, documentation: doc })
        }
        for (const ev of SINTH_EVENTS) {
          suggestions.push({ label: ev, kind: Kind.Event, insertText: `${ev}: $0`, insertTextRules: Snippet, range, detail: 'event handler' })
        }
        for (const a of ['id', 'href', 'src', 'alt', 'type', 'placeholder', 'name', 'disabled', 'required', 'title', 'target', 'rel', 'ariaLabel']) {
          suggestions.push({ label: a, kind: Kind.Field, insertText: `${a}: $0`, insertTextRules: Snippet, range, sortText: 'z' + a })
        }
        return { suggestions }
      }

      for (const e of SINTH_ELEMENTS) {
        suggestions.push({
          label: e.name, kind: Kind.Class, range, detail: `<${e.tag}>${e.note ? ' · ' + e.note : ''}`,
          insertText: e.name === 'Heading' ? 'Heading(level: ${1|1,2,3,4,5,6|}) { $0 }' : `${e.name} { $0 }`, insertTextRules: Snippet,
        })
      }
      for (const [name, sig] of Object.entries(SINTH_UI_COMPONENTS)) {
        suggestions.push({ label: { label: name, description: 'sinth:ui' }, kind: Kind.Class, insertText: name, range, documentation: sig, sortText: 'y' + name })
      }
      for (const k of SINTH_KEYWORDS) suggestions.push({ label: k, kind: Kind.Keyword, insertText: k, range, documentation: KEYWORD_DOCS[k] })
      for (const t of SINTH_TYPES) suggestions.push({ label: t, kind: Kind.TypeParameter, insertText: t, range, detail: t === 'int' ? 'deprecated: use num' : 'type' })
      if (/^\s*\w*$/.test(before)) {
        for (const [key, doc] of Object.entries(SINTH_META_KEYS)) {
          suggestions.push({ label: { label: key, description: 'page metadata' }, kind: Kind.Property, insertText: `${key} = "$0"`, insertTextRules: Snippet, range, documentation: doc, sortText: 'x' + key })
        }
      }
      return { suggestions }
    },
  })

  monaco.languages.registerHoverProvider(SINTH_LANGUAGE_ID, {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position)
      if (!word) return null
      const w = word.word
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
      const element = SINTH_ELEMENTS.find(e => e.name === w)
      if (element) return { range, contents: [{ value: `**${w}** → \`<${element.tag}>\`` }, ...(element.note ? [{ value: element.note }] : [])] }
      if (SINTH_UI_COMPONENTS[w]) return { range, contents: [{ value: `**${w}** (sinth:ui)` }, { value: '`' + SINTH_UI_COMPONENTS[w] + '`' }] }
      if (KEYWORD_DOCS[w]) return { range, contents: [{ value: `**${w}**` }, { value: KEYWORD_DOCS[w] }] }
      if (SINTH_DIRECTIVES[w]) return { range, contents: [{ value: `**${w}:**` }, { value: SINTH_DIRECTIVES[w] }] }
      if (SINTH_META_KEYS[w]) return { range, contents: [{ value: `**${w}** (page metadata)` }, { value: SINTH_META_KEYS[w] }] }
      return null
    },
  })

  monaco.languages.registerDocumentFormattingEditProvider(SINTH_LANGUAGE_ID, {
    provideDocumentFormattingEdits(model) {
      const source = model.getValue()
      const formatted = formatSinth(source)
      return formatted === source ? [] : [{ range: model.getFullModelRange(), text: formatted }]
    },
  })
}

function braceDelta(line: string): { opens: number; closesFirst: boolean; net: number } {
  let net = 0
  let quote = ''
  const code = line.replace(/--(?!\[).*$/, '')
  for (let i = 0; i < code.length; i++) {
    const c = code[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') net++
    else if (c === '}') net--
  }
  return { opens: net, closesFirst: code.trimStart().startsWith('}'), net }
}

export function formatSinth(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let indent = 0
  const out: string[] = []
  let blank = 0
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      if (++blank <= 1) out.push('')
      continue
    }
    blank = 0
    const d = braceDelta(line)
    const lineIndent = d.closesFirst ? Math.max(0, indent - 1) : indent
    out.push('  '.repeat(lineIndent) + line)
    indent = Math.max(0, indent + d.net)
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out.join('\n') + '\n'
}
