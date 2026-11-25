"use client";

import Link from "next/link";
import { ArrowRightLeft, Bot, Eye, ListOrdered, Monitor, Phone, Plug, Plus, Smartphone, WandSparkles, Workflow, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InstallAppButton } from "@/components/shell/install-app";
import { cn } from "@/lib/utils";
import { SlideRow } from "../slide-row";

// Get started and What's new: tiles in one row that slides sideways. Any
// tile can be hidden (and brought back) from the card itself.

type Set = (patch: Record<string, unknown>) => void;

const START = [
  { id: "setup", icon: WandSparkles, title: "Get started", desc: "Set up Redial step by step: number, where calls go, screening, your assistant.", href: "/setup" },
  { id: "phone", icon: Smartphone, title: "Purchase a new phone", desc: "Desk phones and mobiles that work with Redial out of the box.", href: "/phones" },
  { id: "port", icon: ArrowRightLeft, title: "Connect your existing number", desc: "Keep the number people already know and move it to Redial.", href: "/calls/port" },
  { id: "numbers", icon: ListOrdered, title: "Phone number manager", desc: "All your numbers, where their calls go, and numbers on the way.", href: "/calls/numbers" },
  { id: "add", icon: Plus, title: "Add another number", desc: "A second line for the business, a team or a project.", href: "/calls/numbers/new" },
  { id: "desktop", icon: Monitor, title: "Download the desktop app", desc: "Redial in its own window, in your dock or taskbar.", install: true },
  { id: "mobile", icon: Phone, title: "Download the mobile app", desc: "Redial for Android and iPhone: calls, texts and recordings in your pocket.", soon: true },
];

const NEWS = [
  { id: "ai", icon: Bot, title: "AI Agents", desc: "Your call assistant and AI helpers that answer, route and follow up.", href: "/agents/ai" },
  { id: "tree", icon: Workflow, title: "Call Tree", desc: "Greetings, menus, hours and AI steps for every call.", href: "/call-tree" },
  { id: "mcp", icon: Plug, title: "Claude connector", desc: "Work with your recordings and Redial from Claude.", href: "/developer" },
];

type Tile = { id: string; icon: typeof Bot; title: string; desc: string; href?: string; install?: boolean; soon?: boolean };

function Tiles({ tiles, settings, set, empty }: { tiles: Tile[]; settings?: Record<string, unknown>; set: Set; empty: string }) {
  const hidden = Array.isArray(settings?.hidden) ? (settings!.hidden as string[]) : [];
  const shown = tiles.filter((t) => !hidden.includes(t.id));
  const hide = (id: string) => set({ hidden: [...hidden, id] });
  return (
    <div className="space-y-2">
      {shown.length === 0 ? <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{empty}</p> : (
        <SlideRow label="Tiles">
          {shown.map((t) => {
            const body = (
              <>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><t.icon className="size-5" /></span>
                <span className="min-w-0 pr-5">
                  <span className="flex items-center gap-2 font-medium">{t.title}{t.soon && <Badge variant="outline">Coming soon</Badge>}</span>
                  <span className="mt-0.5 line-clamp-3 block text-sm text-muted-foreground">{t.desc}</span>
                  {t.install && <InstallAppButton className="mt-2" />}
                </span>
              </>
            );
            const cls = cn("relative flex h-full w-[17rem] shrink-0 snap-start gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:w-[19rem]",
              t.href && "transition-colors hover:bg-muted/50", t.soon && "border-dashed");
            return (
              <div key={t.id} className="group relative shrink-0">
                {t.href ? <Link href={t.href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}
                <button type="button" onClick={() => hide(t.id)} aria-label={`Hide ${t.title}`} title="Hide"
                  className="absolute top-2 right-2 grid size-6 place-items-center rounded-md text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </SlideRow>
      )}
      {hidden.length > 0 && (
        <button type="button" onClick={() => set({ hidden: [] })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Eye className="size-3.5" /> Show {hidden.length} hidden
        </button>
      )}
    </div>
  );
}

export function GetStartedCard({ settings, set }: { settings?: Record<string, unknown>; set: Set }) {
  return <Tiles tiles={START} settings={settings} set={set} empty="All Get started tiles are hidden." />;
}

export function WhatsNewCard({ settings, set }: { settings?: Record<string, unknown>; set: Set }) {
  return <Tiles tiles={NEWS} settings={settings} set={set} empty="Nothing new to show." />;
}
