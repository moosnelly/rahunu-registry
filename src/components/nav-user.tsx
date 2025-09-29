"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { useTransition } from "react"
import { CircleUserRound, LogOut } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavUserProps = {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string | null
  }
}

export function NavUser({ user }: NavUserProps) {
  const [isPending, startTransition] = useTransition()
  const displayName = user.name ?? user.email ?? "Guest"
  const initials = displayName
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2)

  const handleSignOut = () => {
    startTransition(() => {
      void signOut({ callbackUrl: "/auth/signin" })
    })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar className="h-8 w-8 rounded-lg">
                {user.image ? (
                  <AvatarImage src={user.image} alt={displayName} />
                ) : (
                  <AvatarFallback className="rounded-lg">
                    {initials || <CircleUserRound className="size-4" />}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-1 flex-col text-left">
                <span className="truncate text-sm font-medium">{displayName}</span>
                {user.role ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {user.role}
                  </span>
                ) : null}
                {user.email && user.email !== displayName ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                ) : null}
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-60" align="end" sideOffset={6}>
            <DropdownMenuLabel className="p-0">
              <div className="flex items-center gap-2 px-3 py-2">
                <Avatar className="h-9 w-9 rounded-lg">
                  {user.image ? (
                    <AvatarImage src={user.image} alt={displayName} />
                  ) : (
                    <AvatarFallback className="rounded-lg text-base">
                      {initials || <CircleUserRound className="size-4" />}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex flex-1 flex-col text-sm">
                  <span className="truncate font-medium">{displayName}</span>
                  {user.email ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/">
                  <span>Dashboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/entries">
                  <span>Entries</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2" disabled={isPending} onClick={handleSignOut}>
              <LogOut className="size-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
