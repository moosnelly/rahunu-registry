"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronsUpDown, Plus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type Team = {
  name: string
  logo: React.ElementType
  plan: string
  url?: string
}

interface TeamSwitcherProps {
  teams: Team[]
  activeTeamName?: string
}

export function TeamSwitcher({ teams, activeTeamName }: TeamSwitcherProps) {
  const router = useRouter()
  const [activeTeam, setActiveTeam] = React.useState<Team | null>(null)

  React.useEffect(() => {
    if (!teams.length) {
      setActiveTeam(null)
      return
    }

    if (activeTeamName) {
      const matchedTeam = teams.find((team) => team.name === activeTeamName)
      if (matchedTeam) {
        setActiveTeam(matchedTeam)
        return
      }
    }

    setActiveTeam((prev) => prev ?? teams[0] ?? null)
  }, [activeTeamName, teams])

  if (!activeTeam) {
    return null
  }

  const handleSelect = (team: Team) => {
    setActiveTeam(team)
    if (team.url) {
      router.push(team.url as any)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <activeTeam.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeTeam.plan}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="start"
            sideOffset={6}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Teams
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => handleSelect(team)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <team.logo className="size-3.5 shrink-0" />
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{team.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {team.plan}
                  </span>
                </div>
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add team</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
