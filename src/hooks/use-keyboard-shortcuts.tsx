"use client"

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

export type KeyboardShortcut = {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  description: string
  action: () => void
  category: 'Navigation' | 'Actions' | 'UI' | 'Search'
}

type UseKeyboardShortcutsOptions = {
  shortcuts?: KeyboardShortcut[]
  enabled?: boolean
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { shortcuts = [], enabled = true } = options

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in input fields
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Allow Escape key even in input fields
        if (event.key !== 'Escape') {
          return
        }
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey

        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          altMatch &&
          shiftMatch &&
          (shortcut.meta === undefined || metaMatch)
        ) {
          event.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}

export function useGlobalKeyboardShortcuts(userRole?: string | null) {
  const router = useRouter()
  const { setTheme, theme, resolvedTheme } = useTheme()

  const toggleTheme = useCallback(() => {
    const isDark = (theme ?? resolvedTheme) === 'dark'
    setTheme(isDark ? 'light' : 'dark')
  }, [setTheme, theme, resolvedTheme])

  const toggleSidebar = useCallback(() => {
    // Trigger sidebar toggle by clicking the trigger button
    const sidebarTrigger = document.querySelector('[data-sidebar="trigger"]') as HTMLButtonElement
    if (sidebarTrigger) {
      sidebarTrigger.click()
    }
  }, [])

  const focusSearch = useCallback(() => {
    // Focus on search input if it exists
    const searchInput = document.querySelector('input[type="text"], input[type="search"]') as HTMLInputElement
    if (searchInput) {
      searchInput.focus()
      searchInput.select()
    }
  }, [])

  const isAdmin = userRole === 'ADMIN'
  const canWrite = userRole === 'ADMIN' || userRole === 'DATA_ENTRY'

  const allShortcuts: KeyboardShortcut[] = [
    // Navigation shortcuts (using Alt to avoid browser conflicts)
    {
      key: 'd',
      alt: true,
      description: 'Go to Dashboard',
      action: () => router.push('/dashboard'),
      category: 'Navigation',
    },
    {
      key: 'e',
      alt: true,
      description: 'Go to Entries',
      action: () => router.push('/entries'),
      category: 'Navigation',
    },
    {
      key: 'r',
      alt: true,
      description: 'Go to Reports',
      action: () => router.push('/reports'),
      category: 'Navigation',
    },
    // Admin-only navigation shortcuts
    ...(isAdmin
      ? [
          {
            key: 'u',
            ctrl: true,
            shift: true,
            description: 'Go to User Management',
            action: () => router.push('/admin/users'),
            category: 'Navigation' as const,
          },
          {
            key: 'a',
            ctrl: true,
            shift: true,
            description: 'Go to Audit Log',
            action: () => router.push('/admin/audit'),
            category: 'Navigation' as const,
          },
          {
            key: 's',
            ctrl: true,
            shift: true,
            description: 'Go to System Settings',
            action: () => router.push('/admin/settings'),
            category: 'Navigation' as const,
          },
        ]
      : []),
    // Action shortcuts (only for users with write permission)
    ...(canWrite
      ? [
          {
            key: 'n',
            alt: true,
            description: 'Create New Entry',
            action: () => router.push('/entries/new'),
            category: 'Actions' as const,
          },
        ]
      : []),
    // UI shortcuts
    {
      key: 't',
      alt: true,
      description: 'Toggle Theme (Light/Dark)',
      action: toggleTheme,
      category: 'UI',
    },
    {
      key: 'b',
      alt: true,
      description: 'Toggle Sidebar',
      action: toggleSidebar,
      category: 'UI',
    },
    // Search shortcuts
    {
      key: '/',
      description: 'Focus Search Input',
      action: focusSearch,
      category: 'Search',
    },
    {
      key: 'k',
      ctrl: true,
      description: 'Show Keyboard Shortcuts Help',
      action: () => {
        // This will be handled by the KeyboardShortcutsDialog
        const event = new CustomEvent('toggle-shortcuts-dialog')
        window.dispatchEvent(event)
      },
      category: 'UI',
    },
  ]

  return allShortcuts
}

