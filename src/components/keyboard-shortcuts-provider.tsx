"use client"

import { useSession } from 'next-auth/react'
import { useKeyboardShortcuts, useGlobalKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role ?? null
  
  const shortcuts = useGlobalKeyboardShortcuts(userRole)
  useKeyboardShortcuts({ shortcuts, enabled: true })

  return (
    <>
      {children}
      <KeyboardShortcutsDialog userRole={userRole} />
    </>
  )
}

