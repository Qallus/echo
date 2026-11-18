"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChartNoAxesColumn, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Hide or show the stat cards on every page (one choice, remembered in this
// browser). Stat cards carry the .stat-card class; when hidden, <html> gets
// data-stats="hidden" and globals.css hides them. The switch only appears on
// pages that have stat cards.

const KEY = "redial.stats-hidden";
const listeners = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
function setHidden(hidden: boolean) {
  try { localStorage.setItem(KEY, hidden ? "1" : "0"); } catch {}
  listeners.forEach((fn) => fn());
}

export function StatsToggle({ className }: { className?: string }) {
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  const pathname = usePathname();
  const [present, setPresent] = useState(false);

  useEffect(() => {
    if (hidden) document.documentElement.dataset.stats = "hidden";
    else delete document.documentElement.dataset.stats;
  }, [hidden]);

  // Show the switch only where there are stat cards (checked after each page loads).
  useEffect(() => {
    const check = () => setPresent(Boolean(document.querySelector(".stat-card")));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  if (!present) return null;
  return (
    <button type="button" onClick={() => setHidden(!hidden)} aria-pressed={!hidden}
      title={hidden ? "Show the stat cards" : "Hide the stat cards"}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 text-sm font-medium text-muted-foreground hover:text-foreground", hidden && "opacity-70", className)}>
      <span className="hidden sm:inline">Stats</span>
      {hidden ? <EyeOff className="size-4" /> : <ChartNoAxesColumn className="size-4" />}
    </button>
  );
}
