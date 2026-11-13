"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AudioLines, AudioWaveform, Briefcase, CalendarDays, PhoneIncoming, ChevronDown, Receipt, CircleHelp, Compass, CreditCard, Files, Folder, FolderPlus, Headphones, Headset, Home, Inbox,
  LayoutTemplate, ListTodo, Lock, LogOut, Mic, Monitor, Phone, Plug, Plus, Search, Settings, ShieldCheck, Sparkles, Trash2, Upload, UserRound, Users, Video, Workflow,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { createFolder, fileRecordings, moveRecordings, type BulkResult } from "@/lib/actions";
import { isRecordingDrag, readDraggedIds } from "@/lib/dnd";
import { useRecorder } from "@/components/recorder/recorder-provider";
import { UserAvatar } from "@/components/profile/user-avatar";
import { NotificationBell } from "@/components/notifications/bell";
import { ThemeToggle } from "@/components/theme";
import type { Folder as FolderT, Recording, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

const main = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/", label: "Home", icon: Home },
  { href: "/ask", label: "Ask Echo", icon: Sparkles },
  { href: "/shared", label: "Shared with me", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/explore", label: "Explore", icon: Compass },
];
const build = [
  { href: "/backlog", label: "Backlog", icon: ListTodo },
  { href: "/developer", label: "Developer", icon: Plug },
];

type DropHandlers = Pick<React.HTMLAttributes<HTMLElement>, "onDragOver" | "onDragLeave" | "onDrop">;
type NavProps = { href: string; label: string; icon: typeof Home; n?: number; exact?: boolean; drop?: DropHandlers; highlight?: boolean };

// Module-level so its identity is stable across renders (drag-over re-renders the sidebar).
function NavItem({ href, label, icon: Icon, n, exact, drop, highlight }: NavProps) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" || pathname === "/home" : exact ? pathname === href : pathname.startsWith(href);
  return (
    <SidebarMenuItem {...drop} className={cn(highlight && "rounded-md bg-sidebar-accent ring-2 ring-sidebar-ring")}>
      <SidebarMenuButton isActive={active} tooltip={label} render={<Link href={href} />}>
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
      {n !== undefined && <SidebarMenuBadge>{n}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

export type Me = { id: string; name: string | null; email: string; avatarUrl: string | null; unread: number };
type Props = { me: Me; workspaces: Workspace[]; recordings: Recording[]; folders: FolderT[]; superAdmin: boolean; callsUnread?: number | null; phoneLine?: boolean; liveAgent?: boolean };

export function AppSidebar({ me, workspaces, recordings, folders, superAdmin, callsUnread = null, phoneLine = false, liveAgent = false }: Props) {
  const { email } = me;
  const [pending, startTransition] = useTransition();
  const recorder = useRecorder();
  const { isMobile, state } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  const active = recordings.filter((r) => !r.deletedAt);
  const bySource = (s: Recording["source"]) => active.filter((r) => r.source === s).length;
  const sources = [
    { href: "/library/source/calls", label: "Phone calls", icon: Phone, n: bySource("phone_call") },
    { href: "/library/source/meetings", label: "Meetings", icon: Video, n: bySource("meeting") },
    { href: "/library/source/uploads", label: "Uploads", icon: Upload, n: bySource("upload") },
    { href: "/library/source/desktop", label: "Desktop", icon: Monitor, n: bySource("desktop") },
  ];

  // Drag recordings from a list onto a workspace section or a folder.
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const dropProps = (key: string, act: (ids: string[]) => Promise<BulkResult>, label: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!isRecordingDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (dropTarget !== key) setDropTarget(key);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      const ids = readDraggedIds(e);
      if (!ids.length) return;
      startTransition(async () => {
        const res = await act(ids);
        const ok = res.done ? `Moved ${res.done} to ${label}.` : "";
        setNotice({ text: [ok, ...res.errors].filter(Boolean).join(" "), error: res.errors.length > 0 });
        setTimeout(() => setNotice(undefined), 6000);
      });
    },
  });
  const dropRing = (key: string) => dropTarget === key && "rounded-md bg-sidebar-accent ring-2 ring-sidebar-ring";

  const newFolder = (ws: Workspace) => {
    const name = window.prompt(`New folder in ${ws.isPersonal ? "Personal" : ws.name}`);
    if (name?.trim()) startTransition(() => createFolder(name, ws.id));
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 pt-1">
            <SidebarTrigger aria-label="Expand sidebar" title="Expand sidebar" />
            <NotificationBell userId={me.id} initialUnread={me.unread} />
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1 pl-2">
            <AudioLines className="size-5" />
            <span className="text-lg font-semibold tracking-[0.2em]">ECHO</span>
            {/* Phones show the bell in the top header instead. */}
            <span className="ml-auto flex items-center">
              <ThemeToggle />
              {!isMobile && <NotificationBell userId={me.id} initialUnread={me.unread} />}
              {!isMobile && <SidebarTrigger aria-label="Collapse sidebar" title="Collapse sidebar" />}
            </span>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="justify-between" />}>
            <span className="flex min-w-0 items-center gap-2">
              <UserAvatar name={me.name} email={email} src={me.avatarUrl} size="sm" />
              <span className="min-w-0 text-left leading-tight">
                <span className="block truncate font-medium">{me.name || email}</span>
                {me.name && <span className="block truncate text-xs text-muted-foreground">{email}</span>}
              </span>
            </span>
            <ChevronDown className="opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
              <DropdownMenuItem render={<Link href="/settings" />}><UserRound /> Profile</DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings/account" />}><Settings /> Account settings</DropdownMenuItem>
              {superAdmin && <DropdownMenuItem render={<Link href="/admin" />}><ShieldCheck /> Admin</DropdownMenuItem>}
              <DropdownMenuItem render={<Link href="/team" />}><Users /> Business workspaces &amp; team</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/billing" />}><CreditCard /> Billing &amp; plan</DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/orders" />}><Receipt /> Orders &amp; receipts</DropdownMenuItem>
            <DropdownMenuItem><CircleHelp /> Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action="/auth/signout" method="post">
              <DropdownMenuItem render={<button type="submit" className="w-full" />}><LogOut /> Sign out</DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          {collapsed ? (
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="mx-auto" aria-label="New recording" title="New recording" />}>
              <Plus />
            </DropdownMenuTrigger>
          ) : (
            <DropdownMenuTrigger render={<Button variant="outline" className="w-full" />}>
              <Plus /> New recording
            </DropdownMenuTrigger>
          )}
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuItem disabled={recorder.status !== "idle"} onClick={() => recorder.openStart("meeting")}><Mic /> Record a meeting</DropdownMenuItem>
            <DropdownMenuItem disabled={recorder.status !== "idle"} onClick={() => recorder.openStart("phone_call")}><Phone /> Record a call</DropdownMenuItem>
            <DropdownMenuItem onClick={() => recorder.openUpload()}><Upload /> Upload audio</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        {notice && !collapsed && (
          <p role="status" className={cn("mx-3 mt-2 rounded-md border px-2 py-1.5 text-xs", notice.error ? "border-destructive/40 text-destructive" : "text-muted-foreground")}>
            {notice.text}
          </p>
        )}
        <SidebarGroup>
          <SidebarMenu>
            {main.map((i) => <NavItem key={i.href} {...i} />)}
            {phoneLine && <NavItem href="/phone" label="Phone" icon={Phone} exact />}
            {callsUnread !== null
              ? <NavItem href="/calls" label="Calls" icon={PhoneIncoming} n={callsUnread || undefined} />
              : <NavItem href="/setup" label="Set up Redial" icon={PhoneIncoming} />}
            <NavItem href="/studio" label="Recording Studio" icon={AudioWaveform} />
            <NavItem href="/call-tree" label="Call Tree" icon={Workflow} />
            <NavItem href="/live-agents" label="Live Agents" icon={Headset} />
            {liveAgent && <NavItem href="/agent-desk" label="Agent Desk" icon={Headphones} />}
          </SidebarMenu>
        </SidebarGroup>
        {workspaces.map((ws) => {
          const mine = recordings.filter((r) => r.workspaceId === ws.id);
          const live = mine.filter((r) => !r.deletedAt);
          const base = `/library/space/${ws.id}`;
          return (
            <div key={ws.id}>
              <SidebarSeparator />
              <SidebarGroup {...dropProps(ws.id, (ids) => moveRecordings(ids, ws.id), ws.isPersonal ? "Personal" : ws.name)}
                className={cn("transition-colors", dropRing(ws.id))}>
                <SidebarGroupLabel className="gap-1.5">
                  {ws.isPersonal ? <Lock className="size-3" /> : <Briefcase className="size-3" />}
                  <span className="truncate">{ws.isPersonal ? "Personal" : `Business · ${ws.name}`}</span>
                </SidebarGroupLabel>
                <SidebarGroupAction title="New folder" onClick={() => newFolder(ws)} disabled={pending}><FolderPlus /></SidebarGroupAction>
                <SidebarMenu>
                  <NavItem href={base} exact label="All files" icon={Files} n={live.length} />
                  <NavItem href={`${base}/unfiled`} label="Unfiled" icon={Inbox} n={live.filter((r) => !r.folderId).length} />
                  {folders.filter((f) => f.workspaceId === ws.id).map((f) => (
                    <NavItem key={f.id} href={`/library/folder/${f.id}`} label={f.name} icon={Folder}
                      n={live.filter((r) => r.folderId === f.id).length}
                      drop={dropProps(f.id, (ids) => fileRecordings(ids, f.id), f.name)} highlight={dropTarget === f.id} />
                  ))}
                  <NavItem href={`${base}/trash`} label="Trash" icon={Trash2} n={mine.length - live.length} />
                </SidebarMenu>
              </SidebarGroup>
            </div>
          );
        })}
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Build</SidebarGroupLabel>
          <SidebarMenu>{build.map((i) => <NavItem key={i.href} {...i} />)}</SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Sources</SidebarGroupLabel>
          <SidebarMenu>{sources.map((i) => <NavItem key={i.href} {...i} />)}</SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 p-3 group-data-[collapsible=icon]:hidden">
        <Link href="/billing" className="rounded-lg border p-3 text-sm hover:bg-sidebar-accent">
          <div className="flex items-center justify-between font-medium">Plan and billing <span className="text-muted-foreground">›</span></div>
          <div className="mt-1 text-xs text-muted-foreground">See your plan and minutes used</div>
        </Link>
        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/team" />}><Users /> Invite teammates</Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
