"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FeatureMenu } from "@/components/shell/feature-menu";
import { AudioWaveform, Briefcase, Headset, LayoutGrid, Lock, Mic, Phone, Plus, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRecorder } from "@/components/recorder/recorder-provider";
import { navItem } from "@/lib/nav";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

// Sticky bottom app bar on phones. The destinations slide sideways when they
// don't all fit; the record button stays pinned on the right.
export function BottomNav({ workspaces, phone = false, liveAgent = false, crmReady = false }: { workspaces: Workspace[]; /** Has a Redial line: show Phone. */ phone?: boolean; liveAgent?: boolean; crmReady?: boolean }) {
  const [features, setFeatures] = useState(false);
  const pathname = usePathname();
  const recorder = useRecorder();
  const scroller = useRef<HTMLDivElement>(null);

  // Same destinations as the sidebar (lib/nav.ts), core ones first.
  const pick = (key: string, label?: string) => {
    const i = navItem(key)!;
    return { href: i.href, label: label ?? i.label, icon: i.icon };
  };
  const items = [
    pick("home"),
    ...(phone ? [pick("dialpad")] : []),
    { href: "/studio", label: "Record", icon: AudioWaveform },
    pick("ask"),
    pick("sms"),
    pick("contacts"),
    pick("calendar"),
    ...workspaces.map((w) => ({
      href: `/library/space/${w.id}`,
      // One Business workspace reads "Business"; with several, their names tell them apart.
      label: w.isPersonal ? "Personal" : workspaces.filter((x) => !x.isPersonal).length > 1 ? w.name : "Business",
      icon: w.isPersonal ? Lock : Briefcase,
    })),
    { href: "/agents", label: "Agents", icon: Headset },
    pick("settings"),
  ];
  const isActive = (href: string) => {
    const path = href.split("?")[0];
    return pathname === path || pathname.startsWith(`${path}/`);
  };

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
          <button type="button" onClick={() => setFeatures(true)} aria-haspopup="dialog"
            className="flex w-[4.5rem] shrink-0 snap-start flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <span className="flex h-7 w-12 items-center justify-center rounded-full"><LayoutGrid className="size-5" /></span>
            <span className="max-w-full truncate px-1">Features</span>
          </button>
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
      <FeatureMenu open={features} onOpenChange={setFeatures} line={phone} liveAgent={liveAgent} crmReady={crmReady} />
    </nav>
  );
}
