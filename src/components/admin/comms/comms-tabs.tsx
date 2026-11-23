"use client";

import { useState } from "react";
import { Bell, Grid3x3, History, Inbox, Mail, MessageSquare, type LucideIcon } from "lucide-react";
import { PhoneModeContext } from "@/components/phone/phone-mode";
import { cn } from "@/lib/utils";

// Admin -> Communications laid out like a phone app. On phones: a sticky row
// of icon tabs (Keypad, Recents, Texts, Inbox, Email, Alerts) under the top
// bar, with unread counts. On wider screens: the usual line tabs, where Calls
// shows the keypad and the call log side by side. The tab is kept in the
// link (?tab=), and every panel stays mounted so a call keeps going while
// you read a text.

export type CommsTab = "keypad" | "recents" | "texts" | "inbox" | "email" | "notifications";
const ICONS: Record<CommsTab, LucideIcon> = { keypad: Grid3x3, recents: History, texts: MessageSquare, inbox: Inbox, email: Mail, notifications: Bell };
const SHORT: Record<CommsTab, string> = { keypad: "Keypad", recents: "Recents", texts: "Texts", inbox: "Inbox", email: "Email", notifications: "Alerts" };
const LONG: Partial<Record<CommsTab, string>> = { keypad: "Calls", texts: "Texts (SMS)", inbox: "Inbox", email: "Email", notifications: "Notifications" };

export function CommsTabs({ initial, badges, showNotifications, panels }: {
  initial: CommsTab;
  badges: Partial<Record<CommsTab, number>>;
  showNotifications: boolean;
  panels: { calls: React.ReactNode; texts: React.ReactNode; inbox: React.ReactNode; email: React.ReactNode; notifications?: React.ReactNode };
}) {
  const [tab, setTab] = useState<CommsTab>(initial);
  const tabs: CommsTab[] = ["keypad", "recents", "texts", "inbox", "email", ...(showNotifications ? ["notifications" as const] : [])];
  const go = (t: CommsTab) => {
    setTab(t);
    try { const u = new URL(window.location.href); u.searchParams.set("tab", t); window.history.replaceState(null, "", u); } catch {}
  };
  const onCalls = tab === "keypad" || tab === "recents";
  const badge = (t: CommsTab, cls: string) => (badges[t] ? <span className={cls}>{badges[t]! > 99 ? "99+" : badges[t]}</span> : null);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Phones: icon tabs, sticky under the top bar. */}
      <nav aria-label="Communications" className="sticky top-12 z-20 -mx-4 border-b bg-background/95 px-1 backdrop-blur md:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => {
            const Icon = ICONS[t];
            const on = tab === t;
            return (
              <button key={t} type="button" onClick={() => go(t)} aria-current={on ? "page" : undefined}
                className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors", on ? "text-foreground" : "text-muted-foreground")}>
                <span className={cn("relative flex h-7 w-11 items-center justify-center rounded-full transition-colors", on && "bg-primary/10")}>
                  <Icon className="size-[1.15rem]" />
                  {badge(t, "absolute -top-1 right-0 min-w-4 rounded-full bg-primary px-1 text-[9px] leading-4 text-primary-foreground")}
                </span>
                {SHORT[t]}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Wider screens: line tabs; Calls covers Keypad and Recents. */}
      <div role="tablist" aria-label="Communications" className="hidden gap-1 border-b md:flex">
        {tabs.filter((t) => t !== "recents").map((t) => {
          const on = t === "keypad" ? onCalls : tab === t;
          return (
            <button key={t} type="button" role="tab" aria-selected={on} onClick={() => go(t)}
              className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors", on ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {LONG[t]}
              {badge(t, "rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground")}
            </button>
          );
        })}
      </div>

      <PhoneModeContext.Provider value={tab === "recents" ? "log" : tab === "keypad" ? "pad" : "both"}>
        <div hidden={!onCalls}>{panels.calls}</div>
      </PhoneModeContext.Provider>
      <div hidden={tab !== "texts"}>{panels.texts}</div>
      <div hidden={tab !== "inbox"}>{panels.inbox}</div>
      <div hidden={tab !== "email"}>{panels.email}</div>
      {showNotifications && <div hidden={tab !== "notifications"}>{panels.notifications}</div>}
    </div>
  );
}
