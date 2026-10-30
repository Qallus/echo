"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AudioLines, Briefcase, ChevronDown, CircleHelp, Compass, CreditCard, Files, Folder, FolderPlus, Home, Inbox,
  LayoutTemplate, Lock, LogOut, Mic, Monitor, Phone, Plus, Search, Settings, ShieldCheck, Sparkles, Trash2, Upload, Users, Video,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { createFolder, fileRecordings, moveRecordings, type BulkResult } from "@/lib/actions";
import { isRecordingDrag, readDraggedIds } from "@/lib/dnd";
import type { Folder as FolderT, Recording, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

const main = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/", label: "Home", icon: Home },
  { href: "/ask", label: "Ask Echo", icon: Sparkles },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/explore", label: "Explore", icon: Compass },
];

type DropHandlers = Pick<React.HTMLAttributes<HTMLElement>, "onDragOver" | "onDragLeave" | "onDrop">;
type NavProps = { href: string; label: string; icon: typeof Home; n?: number; exact?: boolean; drop?: DropHandlers; highlight?: boolean };

// Module-level so its identity is stable across renders (drag-over re-renders the sidebar).
function NavItem({ href, label, icon: Icon, n, exact, drop, highlight }: NavProps) {
  const pathname = usePathname();
  const active = exact || href === "/" ? pathname === href : pathname.startsWith(href);
  return (
    <SidebarMenuItem {...drop} className={cn(highlight && "rounded-md bg-sidebar-accent ring-2 ring-sidebar-ring")}>
      <SidebarMenuButton isActive={active} render={<Link href={href} />}>
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
      {n !== undefined && <SidebarMenuBadge>{n}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

type Props = { email: string; workspaces: Workspace[]; recordings: Recording[]; folders: FolderT[]; superAdmin: boolean };

export function AppSidebar({ email, workspaces, recordings, folders, superAdmin }: Props) {
  const [pending, startTransition] = useTransition();

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
    <Sidebar>
      <SidebarHeader className="gap-3">
        <div className="flex items-center gap-2 px-2 pt-1">
          <AudioLines className="size-5" />
          <span className="text-lg font-semibold tracking-[0.2em]">ECHO</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton className="justify-between" />}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium uppercase">
                {(email || "?")[0]}
              </span>
              <span className="truncate">{email}</span>
            </span>
            <ChevronDown className="opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
              <DropdownMenuItem render={<Link href="/settings" />}><Settings /> Settings</DropdownMenuItem>
              {superAdmin && <DropdownMenuItem render={<Link href="/admin" />}><ShieldCheck /> Admin</DropdownMenuItem>}
              <DropdownMenuItem render={<Link href="/team" />}><Users /> Business workspaces &amp; team</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem><CreditCard /> Billing &amp; plan</DropdownMenuItem>
            <DropdownMenuItem><CircleHelp /> Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action="/auth/signout" method="post">
              <DropdownMenuItem render={<button type="submit" className="w-full" />}><LogOut /> Sign out</DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" className="w-full" />}>
            <Plus /> New recording
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuItem><Mic /> Record a meeting</DropdownMenuItem>
            <DropdownMenuItem><Phone /> Record a call</DropdownMenuItem>
            <DropdownMenuItem><Upload /> Upload audio</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        {notice && (
          <p role="status" className={cn("mx-3 mt-2 rounded-md border px-2 py-1.5 text-xs", notice.error ? "border-destructive/40 text-destructive" : "text-muted-foreground")}>
            {notice.text}
          </p>
        )}
        <SidebarGroup>
          <SidebarMenu>{main.map((i) => <NavItem key={i.href} {...i} />)}</SidebarMenu>
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
          <SidebarGroupLabel>Sources</SidebarGroupLabel>
          <SidebarMenu>{sources.map((i) => <NavItem key={i.href} {...i} />)}</SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 p-3">
        <Link href="/billing" className="rounded-lg border p-3 text-sm hover:bg-sidebar-accent">
          <div className="flex items-center justify-between font-medium">Pro (Trial) <span className="text-muted-foreground">›</span></div>
          <div className="mt-2 h-1 rounded-full bg-primary/80" />
          <div className="mt-2 text-xs text-muted-foreground">∞ Unlimited minutes</div>
        </Link>
        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/team" />}><Users /> Invite teammates</Button>
      </SidebarFooter>
    </Sidebar>
  );
}
