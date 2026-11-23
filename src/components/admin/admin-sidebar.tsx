"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bot, BotMessageSquare, ChartColumn, PhoneCall, FileChartColumn, Workflow, Building2, CalendarDays, FolderOpen, Headset, IdCard, ListChecks, NotebookPen, UsersRound, Contact, CreditCard, LayoutDashboard, LogOut, Magnet, Radar, Settings, SquareKanban, UserRound, Users, Smartphone, Phone } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from "@/components/ui/sidebar";
import { SidebarAccount, SidebarBrand, type ShellUser } from "@/components/shell/shell";
import type { Permission } from "@/lib/admin/permissions";

export type AdminNavItem = Item;
type Item = { href: string; label: string; icon: typeof Users; permission?: Permission; exact?: boolean };

// Super Admin navigation: Main, Manage, Operations, Account.
// Sections join their group as they're built.
export const ADMIN_NAV: { label: string; items: Item[] }[] = [
  {
    label: "Main",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view", exact: true },
      { href: "/admin/analytics", label: "Analytics", icon: ChartColumn, permission: "analytics.view" },
      { href: "/admin/communications", label: "Communications", icon: Phone, permission: "comms.view" },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarDays, permission: "crm.view" },
      { href: "/admin/contacts", label: "Contacts", icon: Contact, permission: "crm.view" },
      { href: "/admin/leads", label: "Leads", icon: Magnet, permission: "crm.view" },
      { href: "/admin/prospects", label: "Prospects", icon: Radar, permission: "crm.view" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/admin/pipeline", label: "Pipeline", icon: SquareKanban, permission: "crm.view" },
      { href: "/admin/plans", label: "Plans", icon: ListChecks, permission: "crm.view" },
      { href: "/admin/workspace", label: "Workspace", icon: NotebookPen, permission: "crm.view" },
      { href: "/admin/reports", label: "Reports", icon: FileChartColumn, permission: "analytics.view" },
      { href: "/admin/waitlist", label: "App waitlist", icon: Smartphone, permission: "comms.view" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/clients", label: "Clients", icon: Building2, permission: "crm.view" },
      { href: "/admin/cards", label: "Business Cards", icon: IdCard, permission: "crm.view" },
      { href: "/admin/documents", label: "Documents", icon: FolderOpen, permission: "crm.view" },
      { href: "/admin/automation", label: "Automation", icon: Workflow, permission: "comms.view" },
      { href: "/admin/redial", label: "Redial", icon: PhoneCall, permission: "users.view" },
      { href: "/admin/live-agents", label: "Live Agents", icon: Headset, permission: "marketplace.view" },
      { href: "/admin/billing", label: "Billing", icon: CreditCard, permission: "billing.view" },
      { href: "/admin/ai", label: "AI", icon: Bot, permission: "ai.view", exact: true },
      { href: "/admin/ai/agents", label: "Agents", icon: BotMessageSquare, permission: "staff.manage" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings", label: "Profile", icon: UserRound },
      { href: "/admin/users", label: "User Management", icon: Users, permission: "users.view" },
      { href: "/admin/team", label: "Team", icon: UsersRound, permission: "crm.view" },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "audit.view" },
    ],
  },
];

export function AdminSidebar({ me, permissions }: { me: ShellUser; permissions: Permission[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const visible = (i: Item) => !i.permission || permissions.includes(i.permission);
  const isActive = (i: Item) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <SidebarBrand />
        <SidebarAccount me={me} mode="admin" canAdmin />
      </SidebarHeader>
      <SidebarContent>
        {ADMIN_NAV.map((g) => {
          const items = g.items.filter(visible);
          if (!items.length) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((i) => (
                  <SidebarMenuItem key={i.href}>
                    <SidebarMenuButton isActive={isActive(i)} tooltip={i.label} render={<Link href={i.href} onClick={() => setOpenMobile(false)} />}>
                      <i.icon /> <span>{i.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="User dashboard" render={<Link href="/home" />}><ArrowLeft /> <span>User dashboard</span></SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action="/auth/signout" method="post">
              <SidebarMenuButton tooltip="Log out" render={<button type="submit" />}><LogOut /> <span>Log out</span></SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
