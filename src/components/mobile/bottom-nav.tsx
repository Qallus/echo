"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  Briefcase, Compass, Home, LayoutTemplate, ListTodo, Lock, Mic, Phone, Plus, Search, Settings, Sparkles, Upload, Users,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRecorder } from "@/components/recorder/recorder-provider";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

// Sticky bottom app bar on phones. The destinations slide sideways when they
// don't all fit; the record button stays pinned on the right.
export function BottomNav({ workspaces }: { workspaces: Workspace[] }) {
  const pathname = usePathname();
  const recorder = useRecorder();
  const scroller = useRef<HTMLDivElement>(null);

  const items = [
    { href: "/", label: "Home", icon: Home },
    { href: "/ask", label: "Ask Echo", icon: Sparkles },
    ...workspaces.map((w) => ({
      href: `/library/space/${w.id}`,
      label: w.isPersonal ? "Personal" : w.name,
      icon: w.isPersonal ? Lock : Briefcase,
    })),
    { href: "/search", label: "Search", icon: Search },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/backlog", label: "Backlog", icon: ListTodo },
    { href: "/team", label: "Team", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname === "/home" : pathname.startsWith(href));

  // Keep the current page's button in view after navigating.
  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  return (
    <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="flex h-16 items-stretch">
        <div
          ref={scroller}
          className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto scroll-px-2 px-1 [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-[4.5rem] shrink-0 snap-start flex-col items-center justify-center gap-1 text-[11px] transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-muted")}>
                  <Icon className="size-5" />
                </span>
                <span className="max-w-full truncate px-1">{label}</span>
              </Link>
            );
          })}
          <span className="w-6 shrink-0" />
        </div>

        <div className="flex items-center border-l px-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="New recording"
              className="flex size-11 items-center justify-center rounded-full bg-foreground text-background shadow-md active:scale-95"
            >
              <Plus className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" sideOffset={10} className="w-56">
              <DropdownMenuItem disabled={recorder.status !== "idle"} onClick={() => recorder.openStart("meeting")}><Mic /> Record a meeting</DropdownMenuItem>
              <DropdownMenuItem disabled={recorder.status !== "idle"} onClick={() => recorder.openStart("phone_call")}><Phone /> Record a call</DropdownMenuItem>
              <DropdownMenuItem onClick={() => recorder.openUpload()}><Upload /> Upload audio</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
