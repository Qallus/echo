"use client";

import Link from "next/link";
import { AudioLines, ChevronDown, CircleHelp, CreditCard, LayoutDashboard, LogOut, Receipt, Settings, ShieldCheck, UserRound, Users } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/notifications/bell";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";

// The pieces both dashboards share, so the user and admin sidebars look the
// same: the brand, the account block, and the top bar in the page's top-right
// corner (theme, notifications, and the User / Admin badge that switches
// between the two dashboards).

export type ShellUser = { id: string; name: string | null; email: string; avatarUrl: string | null; unread: number };
export type Mode = "user" | "admin";

export function SidebarBrand() {
  const { state, isMobile } = useSidebar();
  if (state === "collapsed" && !isMobile) return <div className="flex justify-center pt-1"><SidebarTrigger aria-label="Expand sidebar" title="Expand sidebar" /></div>;
  return (
    <div className="flex items-center gap-2 pt-1 pl-2">
      <Link href="/home" className="flex items-center gap-2">
        <AudioLines className="size-5" />
        <span className="text-lg font-semibold tracking-[0.2em]">REDIAL</span>
      </Link>
      {!isMobile && <SidebarTrigger className="ml-auto" aria-label="Collapse sidebar" title="Collapse sidebar" />}
    </div>
  );
}

export function SidebarAccount({ me, mode, canAdmin }: { me: ShellUser; mode: Mode; canAdmin: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="justify-between" />}>
        <span className="flex min-w-0 items-center gap-2">
          <UserAvatar name={me.name} email={me.email} src={me.avatarUrl} size="sm" />
          <span className="min-w-0 text-left leading-tight">
            <span className="block truncate font-medium">{me.name || me.email}</span>
            {me.name && <span className="block truncate text-xs text-muted-foreground">{me.email}</span>}
          </span>
        </span>
        <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{me.email}</DropdownMenuLabel>
          <DropdownMenuItem render={<Link href="/settings" />}><UserRound /> Profile</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings/account" />}><Settings /> Account settings</DropdownMenuItem>
          {canAdmin && (mode === "user"
            ? <DropdownMenuItem render={<Link href="/admin" />}><ShieldCheck /> Admin dashboard</DropdownMenuItem>
            : <DropdownMenuItem render={<Link href="/home" />}><LayoutDashboard /> User dashboard</DropdownMenuItem>)}
          <DropdownMenuItem render={<Link href="/team" />}><Users /> Business workspaces &amp; team</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/billing" />}><CreditCard /> Billing &amp; plan</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/orders" />}><Receipt /> Orders &amp; receipts</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/support" />}><CircleHelp /> Support</DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem render={<button type="submit" className="w-full" />}><LogOut /> Sign out</DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// "User" or "Admin". Staff get both, as a switch between the dashboards.
export function ModeBadge({ mode, canAdmin, className }: { mode: Mode; canAdmin: boolean; className?: string }) {
  const pill = "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold tracking-wide uppercase transition-colors";
  const user = "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950";
  const admin = "bg-violet-600 text-white dark:bg-violet-500 dark:text-violet-950";
  if (!canAdmin) return <span className={cn(pill, user, className)}><UserRound className="size-3.5" /> User</span>;
  return (
    <nav aria-label="Switch dashboard" className={cn("inline-flex items-center gap-0.5 rounded-full border bg-muted/60 p-0.5", className)}>
      <Link href="/home" aria-current={mode === "user" ? "page" : undefined} title="User dashboard"
        className={cn(pill, mode === "user" ? user : "text-muted-foreground hover:text-foreground")}><UserRound className="size-3.5" /> User</Link>
      <Link href="/admin" aria-current={mode === "admin" ? "page" : undefined} title="Admin dashboard"
        className={cn(pill, mode === "admin" ? admin : "text-muted-foreground hover:text-foreground")}><ShieldCheck className="size-3.5" /> Admin</Link>
    </nav>
  );
}

// The page area's top-right corner on desktop (phones have their own header).
export function TopBar({ me, mode, canAdmin }: { me: ShellUser; mode: Mode; canAdmin: boolean }) {
  return (
    <div className="hidden items-center justify-end gap-1 px-4 pt-3 sm:px-6 md:flex">
      <ThemeToggle />
      <NotificationBell userId={me.id} initialUnread={me.unread} />
      <ModeBadge mode={mode} canAdmin={canAdmin} className="ml-2" />
    </div>
  );
}
