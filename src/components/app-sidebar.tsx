"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Briefcase, ChevronDown, ChevronRight, Folder, FolderPlus, LayoutGrid, Lock, Mic, Phone, Plus, Upload, Users } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { createFolder, fileRecordings, moveRecordings, type BulkResult } from "@/lib/actions";
import { isRecordingDrag, readDraggedIds } from "@/lib/dnd";
import { isActive, NAV_BOTTOM, NAV_GROUPS, NAV_TOP, showItem, type NavGroup, type NavItem } from "@/lib/nav";
import { useRecorder } from "@/components/recorder/recorder-provider";
import { SidebarAccount, SidebarBrand } from "@/components/shell/shell";
import type { Folder as FolderT, Recording, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

// Open/closed state of sidebar groups and folder lists, remembered in this browser.
const OPEN_KEY = "redial.nav.open";
function readOpen(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, boolean>; } catch { return {}; }
}
function useOpenState() {
  const raw = useSyncExternalStore(
    (fn) => { window.addEventListener(OPEN_KEY, fn); return () => window.removeEventListener(OPEN_KEY, fn); },
    () => { try { return localStorage.getItem(OPEN_KEY) ?? "{}"; } catch { return "{}"; } },
    () => "{}",
  );
  const state = JSON.parse(raw) as Record<string, boolean>;
  const set = (id: string, open: boolean) => {
    try { localStorage.setItem(OPEN_KEY, JSON.stringify({ ...readOpen(), [id]: open })); } catch {}
    window.dispatchEvent(new Event(OPEN_KEY));
  };
  return [state, set] as const;
}

type DropHandlers = Pick<React.HTMLAttributes<HTMLElement>, "onDragOver" | "onDragLeave" | "onDrop">;

// Module-level so its identity is stable across renders (drag-over re-renders the sidebar).
function NavLink({ item, n, drop, highlight, children }: { item: NavItem; n?: number; drop?: DropHandlers; highlight?: boolean; children?: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const { icon: Icon } = item;
  const active = isActive(item.href, pathname, search, item.exact, item.defaultTab);
  return (
    <SidebarMenuItem {...drop} className={cn(highlight && "rounded-md bg-sidebar-accent ring-2 ring-sidebar-ring")}>
      <SidebarMenuButton isActive={active} tooltip={item.soon ? `${item.label} (coming soon)` : item.label} render={<Link href={item.href} />}>
        <Icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
      {item.soon ? (
        <SidebarMenuBadge className="text-[10px] font-normal text-muted-foreground">Soon</SidebarMenuBadge>
      ) : n ? <SidebarMenuBadge>{n}</SidebarMenuBadge> : null}
      {children}
    </SidebarMenuItem>
  );
}

function Group({ group, open, onToggle, children }: { group: NavGroup; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { isMobile, state } = useSidebar();
  const iconOnly = state === "collapsed" && !isMobile;
  return (
    <SidebarGroup className="py-1">
      {group.label && (
        <SidebarGroupLabel render={<button type="button" onClick={onToggle} aria-expanded={open} />}
          className="w-full cursor-pointer justify-between uppercase tracking-wide hover:text-sidebar-foreground">
          {group.label}
          <ChevronDown className={cn("transition-transform", !open && "-rotate-90")} />
        </SidebarGroupLabel>
      )}
      {(open || iconOnly) && <SidebarMenu>{children}</SidebarMenu>}
    </SidebarGroup>
  );
}

export type Me = { id: string; name: string | null; email: string; avatarUrl: string | null; unread: number };
type Props = { me: Me; workspaces: Workspace[]; recordings: Recording[]; folders: FolderT[]; superAdmin: boolean; callsUnread?: number | null; phoneLine?: boolean; liveAgent?: boolean };

export function AppSidebar({ me, workspaces, recordings, folders, superAdmin, callsUnread = null, liveAgent = false }: Props) {
  const [pending, startTransition] = useTransition();
  const recorder = useRecorder();
  const pathname = usePathname();
  const { isMobile, state } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const [openState, setOpen] = useOpenState();
  const who = { line: callsUnread !== null, liveAgent };
  const badge: Record<string, number | undefined> = { dialpad: callsUnread || undefined, notifications: me.unread || undefined };

  // Drag recordings from a list onto a workspace or a folder.
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const dropProps = (key: string, act: (ids: string[]) => Promise<BulkResult>, label: string): DropHandlers => ({
    onDragOver: (e) => {
      if (!isRecordingDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (dropTarget !== key) setDropTarget(key);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
    },
    onDrop: (e) => {
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

  const newFolder = (ws: Workspace) => {
    const name = window.prompt(`New folder in ${ws.isPersonal ? "Personal" : ws.name}`);
    if (name?.trim()) startTransition(() => createFolder(name, ws.id));
  };

  const businesses = workspaces.filter((w) => !w.isPersonal);
  const wsLabel = (ws: Workspace) => (ws.isPersonal ? "Personal files" : businesses.length > 1 ? `Business · ${ws.name}` : "Business files");

  // One item per workspace, with its folders folding out underneath.
  const fileItems = workspaces.map((ws) => {
    const live = recordings.filter((r) => r.workspaceId === ws.id && !r.deletedAt);
    const mine = folders.filter((f) => f.workspaceId === ws.id);
    const key = `ws:${ws.id}`;
    const inside = mine.some((f) => pathname === `/library/folder/${f.id}`);
    const open = openState[key] ?? inside;
    const item: NavItem = { key, href: `/library/space/${ws.id}`, label: wsLabel(ws), icon: ws.isPersonal ? Lock : Briefcase };
    return (
      <NavLink key={key} item={item} drop={dropProps(ws.id, (ids) => moveRecordings(ids, ws.id), ws.isPersonal ? "Personal" : ws.name)} highlight={dropTarget === ws.id}>
        <SidebarMenuAction className="right-7" title="New folder" onClick={() => newFolder(ws)} disabled={pending}><FolderPlus /></SidebarMenuAction>
        <SidebarMenuAction title={open ? "Hide folders" : "Show folders"} aria-expanded={open} onClick={() => setOpen(key, !open)}>
          <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
        </SidebarMenuAction>
        {open && (
          <SidebarMenuSub>
            {mine.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">No folders yet</li>}
            {mine.map((f) => (
              <SidebarMenuSubItem key={f.id} {...dropProps(f.id, (ids) => fileRecordings(ids, f.id), f.name)}
                className={cn(dropTarget === f.id && "rounded-md bg-sidebar-accent ring-2 ring-sidebar-ring")}>
                <SidebarMenuSubButton isActive={pathname === `/library/folder/${f.id}`} render={<Link href={`/library/folder/${f.id}`} />}>
                  <Folder /><span>{f.name}</span>
                </SidebarMenuSubButton>
                <span className="pointer-events-none absolute top-1 right-1 text-xs text-muted-foreground tabular-nums">{live.filter((r) => r.folderId === f.id).length || ""}</span>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        )}
      </NavLink>
    );
  });

  const renderGroup = (g: NavGroup) => {
    const items = g.items.filter((i) => showItem(i, who));
    const links = items.map((i) => <NavLink key={i.key} item={i} n={badge[i.key]} />);
    return (
      <Group key={g.id} group={g} open={openState[g.id] ?? true} onToggle={() => setOpen(g.id, !(openState[g.id] ?? true))}>
        {/* File Manager: Recording Studio, then the workspaces, then Templates. */}
        {g.files ? [links[0], ...fileItems, ...links.slice(1)] : links}
      </Group>
    );
  };

  const recordButton = (
    <DropdownMenu>
      {collapsed ? (
        <DropdownMenuTrigger render={<Button size="icon" className="mx-auto" aria-label="New recording" title="New recording" />}>
          <Plus />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger render={<Button className="w-full" />}>
          <span className="size-2 rounded-full bg-red-500" /> New recording <Plus className="ml-auto" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent className="w-60" align="start">
        <DropdownMenuItem disabled={recorder.status !== "idle"} onClick={() => recorder.openStart("meeting")}><Mic /> Record a meeting</DropdownMenuItem>
        <DropdownMenuItem disabled={recorder.status !== "idle"} onClick={() => recorder.openStart("phone_call")}><Phone /> Record a call</DropdownMenuItem>
        <DropdownMenuItem onClick={() => recorder.openUpload()}><Upload /> Upload audio</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const contactsAt = NAV_GROUPS.findIndex((g) => g.id === "contacts");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <SidebarBrand />
        <SidebarAccount me={me} mode="user" canAdmin={superAdmin} />
      </SidebarHeader>

      <SidebarContent>
        {notice && !collapsed && (
          <p role="status" className={cn("mx-3 mt-2 rounded-md border px-2 py-1.5 text-xs", notice.error ? "border-destructive/40 text-destructive" : "text-muted-foreground")}>
            {notice.text}
          </p>
        )}
        <SidebarGroup className="py-1">
          <SidebarMenu>
            {NAV_TOP.map((i) => <NavLink key={i.key} item={i} />)}
            <NavLink item={{ key: "features", href: "/explore", label: "All features", icon: LayoutGrid, exact: true }} />
          </SidebarMenu>
        </SidebarGroup>
        {NAV_GROUPS.slice(0, contactsAt + 1).map(renderGroup)}
        <div className="px-2 py-2">{recordButton}</div>
        {NAV_GROUPS.slice(contactsAt + 1).map(renderGroup)}
        <SidebarSeparator />
        <SidebarGroup className="py-1">
          <SidebarMenu>{NAV_BOTTOM.map((i) => <NavLink key={i.key} item={i} />)}</SidebarMenu>
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
