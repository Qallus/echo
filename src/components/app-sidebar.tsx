"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  AudioLines, ChevronDown, CircleHelp, Compass, CreditCard, Files, Folder, FolderPlus, Home, Inbox,
  LayoutTemplate, LogOut, Mic, Monitor, Phone, Plus, Search, Settings, Sparkles, Trash2, Upload, Users, Video,
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
import { createFolder } from "@/lib/actions";
import type { Folder as FolderT, Recording, Workspace } from "@/lib/types";

const main = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/", label: "Home", icon: Home },
  { href: "/ask", label: "Ask Echo", icon: Sparkles },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/explore", label: "Explore", icon: Compass },
];

type Props = { email: string; workspace: Workspace; recordings: Recording[]; folders: FolderT[] };

export function AppSidebar({ email, workspace, recordings, folders }: Props) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const active = recordings.filter((r) => !r.deletedAt);
  const bySource = (s: Recording["source"]) => active.filter((r) => r.source === s).length;
  const library = [
    { href: "/library/all", label: "All files", icon: Files, n: active.length },
    { href: "/library/unfiled", label: "Unfiled", icon: Inbox, n: active.filter((r) => !r.folderId).length },
    { href: "/library/trash", label: "Trash", icon: Trash2, n: recordings.length - active.length },
  ];
  const sources = [
    { href: "/library/source/calls", label: "Phone calls", icon: Phone, n: bySource("phone_call") },
    { href: "/library/source/meetings", label: "Meetings", icon: Video, n: bySource("meeting") },
    { href: "/library/source/uploads", label: "Uploads", icon: Upload, n: bySource("upload") },
    { href: "/library/source/desktop", label: "Desktop", icon: Monitor, n: bySource("desktop") },
  ];

  const newFolder = () => {
    const name = window.prompt("Folder name");
    if (name?.trim()) startTransition(() => createFolder(name));
  };

  const NavItem = ({ href, label, icon: Icon, n }: { href: string; label: string; icon: typeof Home; n?: number }) => (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive(href)} render={<Link href={href} />}>
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
      {n !== undefined && <SidebarMenuBadge>{n}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );

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
              <span className="truncate">{workspace.name}</span>
            </span>
            <ChevronDown className="opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
              <DropdownMenuItem><Settings /> Settings</DropdownMenuItem>
              <DropdownMenuItem><Users /> Create a team workspace</DropdownMenuItem>
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
        <SidebarGroup>
          <SidebarMenu>{main.map((i) => <NavItem key={i.href} {...i} />)}</SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarMenu>{library.map((i) => <NavItem key={i.href} {...i} />)}</SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupAction title="New folder" onClick={newFolder} disabled={pending}><FolderPlus /></SidebarGroupAction>
          <SidebarMenu>
            {folders.map((f) => (
              <NavItem key={f.id} href={`/library/folder/${f.id}`} label={f.name} icon={Folder}
                n={active.filter((r) => r.folderId === f.id).length} />
            ))}
            {!folders.length && <p className="px-2 text-xs text-muted-foreground">No folders yet</p>}
          </SidebarMenu>
        </SidebarGroup>
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
        <Button variant="outline" className="w-full"><Users /> Invite teammates</Button>
      </SidebarFooter>
    </Sidebar>
  );
}
