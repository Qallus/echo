"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChartNoAxesColumn, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Hide or show the stat cards, page by page (remembered in this browser).
// Stat cards carry the .stat-card class; when the current page's cards are
// hidden, <html> gets data-stats="hidden" and globals.css hides them. The
// switch only appears on pages that have stat cards, and turns amber with
// "Stats hidden" while that page's cards are hidden.

const KEY = "redial.stats-hidden-pages";
const listeners = new Set<() => void>();
const readAll = (): string => { try { return localStorage.getItem(KEY) ?? "[]"; } catch { return "[]"; } };
const parse = (raw: string): string[] => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } };
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => { listeners.delete(fn); window.removeEventListener("storage", fn); };
};
function setHidden(page: string, hidden: boolean) {
  const pages = new Set(parse(readAll()));
  if (hidden) pages.add(page); else pages.delete(page);
  try { localStorage.setItem(KEY, JSON.stringify([...pages].slice(-200))); } catch {}
  listeners.forEach((fn) => fn());
}

export function StatsToggle({ className }: { className?: string }) {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, readAll, () => "[]");
  const hidden = parse(raw).includes(pathname);
  const [present, setPresent] = useState(false);

  useEffect(() => {
    if (hidden) document.documentElement.dataset.stats = "hidden";
    else delete document.documentElement.dataset.stats;
  }, [hidden, pathname]);

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
    <button type="button" onClick={() => setHidden(pathname, !hidden)} aria-pressed={hidden}
      title={hidden ? "The stat cards on this page are hidden. Click to show them." : "Hide the stat cards on this page"}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-sm font-medium transition-colors",
        hidden ? "bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-300" : "text-muted-foreground hover:text-foreground", className)}>
      <span className="hidden sm:inline">{hidden ? "Stats hidden" : "Stats"}</span>
      {hidden ? <EyeOff className="size-4" /> : <ChartNoAxesColumn className="size-4" />}
    </button>
  );
}
