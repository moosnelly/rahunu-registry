"use client"

import { useKeyboardShortcuts, useGlobalKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const shortcuts = useGlobalKeyboardShortcuts()
  useKeyboardShortcuts({ shortcuts, enabled: true })

  return (
    <>
      {children}
      <KeyboardShortcutsDialog />
    </>
  )
}

