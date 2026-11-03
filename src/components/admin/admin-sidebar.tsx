"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bot, Building2, Contact, CreditCard, LayoutDashboard, LogOut, Settings, ShieldCheck, SquareKanban, UserRound, Users } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme";
import type { Permission, StaffRole } from "@/lib/admin/permissions";
import { roleLabel } from "@/lib/admin/permissions";

type Item = { href: string; label: string; icon: typeof Users; permission?: Permission; exact?: boolean };

// Super Admin navigation (Channel-Cast-OS layout: Main, Operations, Account).
// Sections join their group as they're built.
const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Main",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view", exact: true },
      { href: "/admin/contacts", label: "Contacts", icon: Contact, permission: "crm.view" },
      { href: "/admin/pipeline", label: "Pipeline", icon: SquareKanban, permission: "crm.view" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/clients", label: "Clients", icon: Building2, permission: "crm.view" },
      { href: "/admin/billing", label: "Billing", icon: CreditCard, permission: "billing.view" },
      { href: "/admin/ai", label: "AI", icon: Bot, permission: "ai.view" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings", label: "Profile", icon: UserRound },
      { href: "/admin/users", label: "User Management", icon: Users, permission: "users.view" },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "audit.view" },
    ],
  },
];

export function AdminSidebar({ role, permissions }: { role: StaffRole; permissions: Permission[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const visible = (i: Item) => !i.permission || permissions.includes(i.permission);
  const isActive = (i: Item) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 pt-1 pl-2">
          <ShieldCheck className="size-5" />
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold tracking-[0.2em]">ECHO ADMIN</span>
            <span className="block text-xs text-muted-foreground">{roleLabel(role)}</span>
          </span>
          <span className="ml-auto"><ThemeToggle /></span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {GROUPS.map((g) => {
          const items = g.items.filter(visible);
          if (!items.length) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((i) => (
                  <SidebarMenuItem key={i.href}>
                    <SidebarMenuButton isActive={isActive(i)} render={<Link href={i.href} onClick={() => setOpenMobile(false)} />}>
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
            <SidebarMenuButton render={<Link href="/" />}><ArrowLeft /> <span>Back to Echo</span></SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action="/auth/signout" method="post">
              <SidebarMenuButton render={<button type="submit" />}><LogOut /> <span>Log out</span></SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
