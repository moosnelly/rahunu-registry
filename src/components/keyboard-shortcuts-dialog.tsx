"use client"

import { useEffect, useState } from 'react'
import { Command, Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { useGlobalKeyboardShortcuts, type KeyboardShortcut } from '@/hooks/use-keyboard-shortcuts'

type KeyboardShortcutsDialogProps = {
  userRole?: string | null
}

export function KeyboardShortcutsDialog({ userRole }: KeyboardShortcutsDialogProps) {
  const [open, setOpen] = useState(false)
  const shortcuts = useGlobalKeyboardShortcuts(userRole)

  useEffect(() => {
    const handleToggle = () => setOpen((prev) => !prev)
    window.addEventListener('toggle-shortcuts-dialog', handleToggle)
    return () => window.removeEventListener('toggle-shortcuts-dialog', handleToggle)
  }, [])

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, KeyboardShortcut[]>)

  const getModifierKey = () => {
    // Detect if user is on Mac
    if (typeof window !== 'undefined') {
      return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'
    }
    return 'Ctrl'
  }

  const modifierKey = getModifierKey()
  const isMac = modifierKey === '⌘'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and perform actions quickly throughout the app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <KbdGroup>
                      {shortcut.alt && (
                        <>
                          <Kbd>{isMac ? '⌥' : 'Alt'}</Kbd>
                          <span className="text-muted-foreground">+</span>
                        </>
                      )}
                      {shortcut.ctrl && (
                        <>
                          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
                          <span className="text-muted-foreground">+</span>
                        </>
                      )}
                      {shortcut.shift && (
                        <>
                          <Kbd>Shift</Kbd>
                          <span className="text-muted-foreground">+</span>
                        </>
                      )}
                      <Kbd>{shortcut.key.toUpperCase()}</Kbd>
                    </KbdGroup>
                  </div>
                ))}
              </div>
              {category !== Object.keys(groupedShortcuts)[Object.keys(groupedShortcuts).length - 1] && (
                <Separator className="my-4" />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Tip:</strong> Press{' '}
              <KbdGroup className="mx-1">
                <Kbd>{modifierKey}</Kbd>
                <span className="text-muted-foreground">+</span>
                <Kbd>K</Kbd>
              </KbdGroup>{' '}
              to quickly access this shortcuts dialog anytime.
            </p>
          </div>
          {userRole && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <p className="text-xs text-blue-900 dark:text-blue-200">
                <strong className="text-blue-950 dark:text-blue-100">Personalized:</strong> Shortcuts shown are tailored to your role ({userRole === 'ADMIN' ? 'Administrator' : userRole === 'DATA_ENTRY' ? 'Data Entry' : 'Viewer'}).
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

