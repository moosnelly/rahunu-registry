"use client"

import { Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

export function KeyboardShortcutsButton() {
  const handleClick = () => {
    const event = new CustomEvent('toggle-shortcuts-dialog')
    window.dispatchEvent(event)
  }

  const getModifierKey = () => {
    if (typeof window !== 'undefined') {
      return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'
    }
    return 'Ctrl'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleClick}
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex items-center gap-2">
            <span>Shortcuts</span>
            <KbdGroup>
              <Kbd>{getModifierKey()}</Kbd>
              <span className="text-muted-foreground">+</span>
              <Kbd>K</Kbd>
            </KbdGroup>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

