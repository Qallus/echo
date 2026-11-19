"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Handshake, Headset, Mail, Phone, Sparkles, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COMPANY } from "@/lib/company";
import { cn } from "@/lib/utils";

// The help button on every public page (bottom right). Opens a small card
// with the phone number, email, the AI assistant and the partner programs.
// Visitors can tuck it away into a slim tab on the right edge; that choice is
// remembered in this browser.

const KEY = "redial.help-fab-hidden";
const EVENT = "redial-help-fab";

function readHidden() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVENT, cb); };
}
function setHidden(v: boolean) {
  try { if (v) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

const ITEMS = [
  { icon: Phone, label: COMPANY.phone, sub: "Call us", href: COMPANY.phoneHref },
  { icon: Mail, label: COMPANY.email, sub: "A real person replies within one business day", href: `mailto:${COMPANY.email}` },
  { icon: Sparkles, label: "Talk to Nicole AI", sub: "Call, and Nicole answers when the team is busy", href: COMPANY.phoneHref },
  { icon: Handshake, label: "Become an Account Executive", sub: "Partners, careers and the reseller program", href: "/partners", internal: true },
];

export function HelpFab() {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false);
  const [open, setOpen] = useState(false);

  if (hidden) {
    return (
      <button type="button" onClick={() => setHidden(false)} aria-label="Show the help button"
        className="fixed right-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-1 rounded-l-xl border border-r-0 bg-foreground px-1.5 py-2.5 text-background shadow-lg transition-all hover:pr-2.5">
        <ChevronLeft className="size-3.5" />
        <Headset className="size-4" />
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 sm:right-6 sm:bottom-6">
      <div className="hidden items-center rounded-full border bg-background shadow-md sm:flex">
        <button type="button" onClick={() => { setOpen(false); setHidden(true); }} aria-label="Hide the help button" title="Hide"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-4" />
        </button>
        <span className="h-4 w-px bg-border" />
        <button type="button" onClick={() => setOpen(true)} className="py-2 pr-4 pl-2.5 text-sm">
          <span className="font-semibold">Need help?</span> <span className="font-medium text-amber-600 dark:text-amber-400">Contact us</span>
        </button>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger aria-label={open ? "Close help" : "Need help? Contact us"}
          className="flex size-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg ring-1 ring-foreground/10 transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {open ? <X className="size-5" /> : <Headset className="size-5" />}
        </PopoverTrigger>
        <PopoverContent side="top" align="end" sideOffset={12} className="w-[min(20rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-2xl p-0">
          <div className="border-b px-4 py-3">
            <p className="font-semibold">Redial Support</p>
            <p className="text-xs text-muted-foreground">Call, email, or talk to our AI assistant any time.</p>
          </div>
          <ul className="divide-y">
            {ITEMS.map(({ icon: Icon, label, sub, href, internal }) => {
              const inner = (
                <>
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
                </>
              );
              const cls = "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted";
              return (
                <li key={label}>
                  {internal
                    ? <Link href={href} className={cls} onClick={() => setOpen(false)}>{inner}</Link>
                    : <a href={href} className={cls}>{inner}</a>}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => { setOpen(false); setHidden(true); }}
            className={cn("w-full border-t px-4 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground")}>
            Hide this button (a small tab stays on the right edge)
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
