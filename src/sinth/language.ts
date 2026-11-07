import type * as Monaco from 'monaco-editor'
import { SINTH_CONSTANTS, SINTH_ELEMENTS, SINTH_KEYWORDS, SINTH_LANGUAGE_ID, SINTH_TYPES } from './constants'

export function registerSinthLanguage(monaco: typeof Monaco): void {
  if (monaco.languages.getLanguages().some(l => l.id === SINTH_LANGUAGE_ID)) return

  monaco.languages.register({ id: SINTH_LANGUAGE_ID, extensions: ['.sinth'], aliases: ['Sinth', 'sinth'], mimetypes: ['text/x-sinth'] })

  monaco.languages.setLanguageConfiguration(SINTH_LANGUAGE_ID, {
    comments: { lineComment: '--', blockComment: ['--[', ']--'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string', 'comment'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
      { open: '`', close: '`', notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" },
    ],
    folding: { markers: { start: /\{\s*$/, end: /^\s*\}/ } },
    indentationRules: { increaseIndentPattern: /^.*\{[^}"']*$/, decreaseIndentPattern: /^\s*\}/ },
    wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s]+)/g,
  })

  monaco.languages.setMonarchTokensProvider(SINTH_LANGUAGE_ID, {
    defaultToken: '',
    tokenPostfix: '.sinth',
    keywords: [...SINTH_KEYWORDS],
    types: [...SINTH_TYPES],
    constants: [...SINTH_CONSTANTS],
    elements: SINTH_ELEMENTS.map(e => e.name),
    symbols: /[=><!~?:&|+\-*/^%]+/,
    tokenizer: {
      root: [
        { include: '@whitespace' },
        [/\b(style)(\s+(?:global|scoped|lang\s*=\s*"[a-z]+"|\s)*)?(\{)/, ['keyword', 'keyword', { token: 'delimiter.curly', next: '@styleBlock' }]],
        [/\b(script)(\s+[^{\n]*)?(\{)/, ['keyword', 'attribute.name', { token: 'delimiter.curly', next: '@scriptBlock' }]],
        [/[fF](?=["'])/, { token: 'string.prefix', next: '@fstringStart' }],
        [/"/, { token: 'string.quote', next: '@dstring' }],
        [/'/, { token: 'string.quote', next: '@sstring' }],
        [/`/, { token: 'string.quote', next: '@template' }],
        [/\$slot\b/, 'keyword.slot'],
        [/\$[a-z_]\w*(?=\s*\()/, 'support.function.memo'],
        [/(on[A-Z]\w*)((?:\.\w+)*)(\s*:)/, ['attribute.event', 'attribute.modifier', 'delimiter']],
        [/([a-z]\w*(?:-\w+)*)(\s*:)(?!:)/, ['attribute.name', 'delimiter']],
        [/[A-Z][\w]*(?:\.[A-Z]\w*)*/, { cases: { '@elements': 'type.element', '@default': 'type.component' } }],
        [/custom-element\b/, 'keyword'],
        [/[a-zA-Z_$][\w$]*(?=\s*\()/, { cases: { '@keywords': 'keyword', '@default': 'function' } }],
        [/[a-zA-Z_$][\w$]*/, { cases: { '@keywords': 'keyword', '@types': 'type', '@constants': 'constant', '@default': 'identifier' } }],
        [/0[xX][0-9a-fA-F_]+/, 'number.hex'],
        [/\d[\d_]*(\.\d+)?([eE][-+]?\d+)?/, 'number'],
        [/[{}()[\]]/, '@brackets'],
        [/@symbols/, 'operator'],
        [/[;,.]/, 'delimiter'],
      ],
      whitespace: [
        [/[ \t\r\n]+/, ''],
        [/--\[/, 'comment', '@blockComment'],
        [/--.*$/, 'comment'],
        [/\/\/.*$/, 'comment'],
      ],
      blockComment: [
        [/--\[/, 'comment', '@push'],
        [/\]--/, 'comment', '@pop'],
        [/[^\]-]+/, 'comment'],
        [/./, 'comment'],
      ],
      dstring: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, 'string.quote', '@pop']],
      sstring: [[/[^\\']+/, 'string'], [/\\./, 'string.escape'], [/'/, 'string.quote', '@pop']],
      fstringStart: [
        [/"/, { token: 'string.quote', switchTo: '@fdstring' }],
        [/'/, { token: 'string.quote', switchTo: '@fsstring' }],
      ],
      fdstring: [[/\\./, 'string.escape'], [/\{/, { token: 'delimiter.interpolation', next: '@interp' }], [/[^\\"{]+/, 'string'], [/"/, 'string.quote', '@pop']],
      fsstring: [[/\\./, 'string.escape'], [/\{/, { token: 'delimiter.interpolation', next: '@interp' }], [/[^\\'{]+/, 'string'], [/'/, 'string.quote', '@pop']],
      template: [[/\\./, 'string.escape'], [/\$\{/, { token: 'delimiter.interpolation', next: '@interp' }], [/[^\\`$]+/, 'string'], [/\$/, 'string'], [/`/, 'string.quote', '@pop']],
      interp: [[/\}/, { token: 'delimiter.interpolation', next: '@pop' }], { include: 'root' }],
      styleBlock: [
        [/--\[/, 'comment', '@blockComment'],
        [/--(?=\s|$).*$/, 'comment'],
        [/\/\*/, 'comment', '@cssComment'],
        [/"[^"]*"|'[^']*'/, 'string'],
        [/(--[\w-]+|[a-zA-Z-][\w-]*)(\s*:)(?=[^{]*$|[^{]*;)/, ['attribute.name.css', 'delimiter']],
        [/(media|dark|light|mobile|tablet|desktop|print|reducedMotion)(?=\s*[({])/, 'keyword'],
        [/@[\w-]+/, 'keyword'],
        [/\b(on[A-Z]\w*|before|after|placeholder|selection|marker)\b/, 'keyword.pseudo'],
        [/[A-Z]\w*/, 'type.element'],
        [/#[0-9a-fA-F]{3,8}\b/, 'number.hex'],
        [/-?\d+(\.\d+)?(px|rem|em|%|vh|vw|s|ms|deg|fr)?/, 'number'],
        [/\{/, 'delimiter.curly', '@styleBlock'],
        [/\}/, 'delimiter.curly', '@pop'],
        [/[^\s{}:;"']+/, 'tag.css'],
        [/[\s:;]+/, ''],
      ],
      cssComment: [[/\*\//, 'comment', '@pop'], [/[^*]+/, 'comment'], [/\*/, 'comment']],
      scriptBlock: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@cssComment'],
        [/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/, 'string'],
        [/\b(const|let|var|function|return|if|else|for|while|of|in|new|async|await|class|try|catch|finally|throw|import|export|from|typeof|this)\b/, 'keyword'],
        [/\b(true|false|null|undefined)\b/, 'constant'],
        [/\d+(\.\d+)?/, 'number'],
        [/[a-zA-Z_$][\w$]*(?=\s*\()/, 'function'],
        [/\{/, 'delimiter.curly', '@scriptBlock'],
        [/\}/, 'delimiter.curly', '@pop'],
        [/[a-zA-Z_$][\w$]*/, 'identifier'],
        [/[^\s{}"'`a-zA-Z_$\d/]+/, 'operator'],
        [/[\s/]/, ''],
      ],
    },
  } as Monaco.languages.IMonarchLanguage)

  const rules: Monaco.editor.ITokenThemeRule[] = [
    { token: 'comment', foreground: '6e6e78', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c084fc' },
    { token: 'keyword.slot', foreground: 'c084fc', fontStyle: 'bold' },
    { token: 'keyword.pseudo', foreground: 'f0abfc' },
    { token: 'type', foreground: '67e8f9' },
    { token: 'type.element', foreground: '93c5fd' },
    { token: 'type.component', foreground: 'fbbf24' },
    { token: 'constant', foreground: 'fda4af' },
    { token: 'identifier', foreground: 'f5f5f6' },
    { token: 'function', foreground: '86efac' },
    { token: 'support.function.memo', foreground: '86efac', fontStyle: 'italic' },
    { token: 'attribute.name', foreground: 'a5b4fc' },
    { token: 'attribute.event', foreground: 'f9a8d4' },
    { token: 'attribute.modifier', foreground: 'f9a8d4', fontStyle: 'italic' },
    { token: 'attribute.name.css', foreground: 'a5b4fc' },
    { token: 'tag.css', foreground: '93c5fd' },
    { token: 'string', foreground: 'fcd34d' },
    { token: 'string.quote', foreground: 'fcd34d' },
    { token: 'string.prefix', foreground: 'c084fc' },
    { token: 'string.escape', foreground: 'fb923c' },
    { token: 'delimiter.interpolation', foreground: 'c084fc' },
    { token: 'number', foreground: 'fdba74' },
    { token: 'number.hex', foreground: 'fdba74' },
    { token: 'operator', foreground: 'd4d4d8' },
  ]

  monaco.editor.defineTheme('sinth-dark', {
    base: 'vs-dark', inherit: true, rules,
    colors: {
      'editor.background': '#0a0a0b', 'editor.foreground': '#f5f5f6',
      'editor.lineHighlightBackground': '#151518', 'editorLineNumber.foreground': '#4a4a52',
      'editorLineNumber.activeForeground': '#a1a1aa', 'editorCursor.foreground': '#c084fc',
      'editor.selectionBackground': '#c084fc42', 'editorIndentGuide.background1': '#1c1c20',
      'editorBracketMatch.border': '#c084fc80', 'editorWidget.background': '#151518',
    },
  })

  monaco.editor.defineTheme('sinth-midnight', {
    base: 'vs-dark', inherit: true, rules,
    colors: {
      'editor.background': '#08080f', 'editor.foreground': '#e0e0ee',
      'editor.lineHighlightBackground': '#1a1a26', 'editorLineNumber.foreground': '#3c3c50',
      'editorLineNumber.activeForeground': '#8888a0', 'editorCursor.foreground': '#6366f1',
      'editor.selectionBackground': '#6366f147',
    },
  })

  monaco.editor.defineTheme('sinth-slate', {
    base: 'vs-dark', inherit: true, rules,
    colors: {
      'editor.background': '#0d1014', 'editor.foreground': '#e2e6ec',
      'editor.lineHighlightBackground': '#21262f', 'editorLineNumber.foreground': '#3a4150',
      'editorLineNumber.activeForeground': '#8f98a8', 'editorCursor.foreground': '#14b8a6',
      'editor.selectionBackground': '#14b8a647',
    },
  })

  monaco.editor.defineTheme('sinth-light', {
    base: 'vs', inherit: true,
    rules: [
      { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7e22ce' },
      { token: 'type', foreground: '0e7490' },
      { token: 'type.element', foreground: '1d4ed8' },
      { token: 'type.component', foreground: 'b45309' },
      { token: 'string', foreground: 'a16207' },
      { token: 'number', foreground: 'c2410c' },
      { token: 'attribute.name', foreground: '4338ca' },
      { token: 'attribute.event', foreground: 'be185d' },
      { token: 'function', foreground: '15803d' },
    ],
    colors: {
      'editor.background': '#ffffff', 'editor.foreground': '#0a0a0b',
      'editor.lineHighlightBackground': '#f4f4f5', 'editorLineNumber.foreground': '#a1a1aa',
      'editorLineNumber.activeForeground': '#52525b', 'editorCursor.foreground': '#9333ea',
      'editor.selectionBackground': '#9333ea2e',
    },
  })
}

export function monacoThemeFor(theme: 'dark' | 'midnight' | 'slate' | 'light'): string {
  switch (theme) {
    case 'midnight': return 'sinth-midnight'
    case 'slate': return 'sinth-slate'
    case 'light': return 'sinth-light'
    default: return 'sinth-dark'
  }
}
