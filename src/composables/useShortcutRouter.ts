import { onMounted, onUnmounted } from 'vue'

export interface ShortcutHandlers {
  onCommandPalette?: () => void
  onQuickOpen?: () => void
  onSave?: () => void
  onSaveAll?: () => void
  onCloseTab?: () => void
  onNewTerminal?: () => void
  onToggleTerminal?: () => void
  onToggleSidebar?: () => void
  onOpenSettings?: () => void
  onSearch?: () => void
  onOpenFolder?: () => void
}

let handlers: ShortcutHandlers = {}

export function registerShortcuts(h: ShortcutHandlers): void {
  handlers = { ...handlers, ...h }
}

export function platformShortcut(combo: string): string {
  const mac = navigator.userAgent.toLowerCase().includes('mac')
  if (!mac) return combo
  return combo.replace(/Ctrl/g, '\u2318').replace(/Shift/g, '\u21e7').replace(/Alt/g, '\u2325').replace(/\+/g, '')
}

export function useShortcutRouter(): void {
  function onKey(e: KeyboardEvent): void {
    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    if (!ctrl) return

    if (shift && e.code === 'KeyP') { e.preventDefault(); handlers.onCommandPalette?.(); return }
    if (!shift && e.code === 'KeyP') { e.preventDefault(); handlers.onQuickOpen?.(); return }
    if (!shift && e.code === 'KeyS') { e.preventDefault(); handlers.onSave?.(); return }
    if (shift && e.code === 'KeyS') { e.preventDefault(); handlers.onSaveAll?.(); return }
    if (e.code === 'KeyW') { e.preventDefault(); handlers.onCloseTab?.(); return }
    if (e.code === 'Backquote') { e.preventDefault(); if (shift) handlers.onNewTerminal?.(); else handlers.onToggleTerminal?.(); return }
    if (!shift && e.code === 'KeyB') { e.preventDefault(); handlers.onToggleSidebar?.(); return }
    if (e.code === 'Comma') { e.preventDefault(); handlers.onOpenSettings?.(); return }
    if (shift && e.code === 'KeyF') { e.preventDefault(); handlers.onSearch?.(); return }
    if (shift && e.code === 'KeyO') { e.preventDefault(); handlers.onOpenFolder?.(); return }
    if (e.code === 'KeyR' || e.code === 'F5') { e.preventDefault() }
  }

  onMounted(() => window.addEventListener('keydown', onKey, { capture: true }))
  onUnmounted(() => window.removeEventListener('keydown', onKey, { capture: true } as EventListenerOptions))
}