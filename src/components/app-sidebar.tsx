"use client"

import { useMemo } from "react"
import {
  FileSpreadsheet,
  Gauge,
  Landmark,
  Settings2,
  ShieldAlert,
  UserRoundCog,
  BarChart3,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string | null
  }
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const role = user?.role ?? "USER"

  const navItems = useMemo(() => {
    const baseItems = [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: Gauge,
      },
      {
        title: "Entries",
        url: "/entries",
        icon: FileSpreadsheet,
      },
      {
        title: "Reports",
        url: "/reports",
        icon: BarChart3,
      },
    ]

    if (role === "ADMIN") {
      baseItems.push(
        {
          title: "User Management",
          url: "/admin/users",
          icon: UserRoundCog,
        },
        {
          title: "Audit Log",
          url: "/admin/audit",
          icon: ShieldAlert,
        }
      )
    }

    return baseItems
  }, [role])

  const projectItems = useMemo(() => {
    if (role !== "ADMIN") {
      return []
    }

    return [
      {
        name: "System Settings",
        url: "/admin/settings",
        icon: Settings2,
      },
      {
        name: "Compliance",
        url: "/admin/audit",
        icon: Landmark,
      },
    ]
  }, [role])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={[
            {
              name: "Rahunu Registry",
              logo: Landmark,
              plan: role,
            },
          ]}
          activeTeamName="Rahunu Registry"
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        <NavProjects projects={projectItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user ?? {}} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
