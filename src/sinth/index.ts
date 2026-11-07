import type * as Monaco from 'monaco-editor'
import { registerSinthLanguage } from './language'
import { registerSinthProviders } from './providers'
import { registerSinthSnippets } from './snippets'

let registered = false

export function registerSinth(monaco: typeof Monaco): void {
  if (registered) return
  registerSinthLanguage(monaco)
  registerSinthProviders(monaco)
  registerSinthSnippets(monaco)
  registered = true
}

export * from './constants'
export * from './language'