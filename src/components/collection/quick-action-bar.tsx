"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The quick-action bar every list in the dashboards uses: fixed to the bottom
// of the screen (above the phone tab bar), showing how many items are ticked,
// "Select all", the page's actions, and a clear button. Pages put their
// action buttons inside; the bar scrolls sideways when they don't fit.
export function QuickActionBar({ count, total, onSelectAll, onClear, message, children, className }: {
  count: number; total?: number; onSelectAll?: () => void; onClear: () => void;
  /** A short result line shown under the bar (e.g. "Archived 3."). */
  message?: { text: string; error?: boolean } | null;
  children: React.ReactNode; className?: string;
}) {
  if (!count) return null;
  return (
    <div data-quick-bar className={cn("fixed inset-x-3 bottom-20 z-40 mx-auto max-w-5xl md:bottom-6 md:left-[calc(var(--sidebar-width,0px)+1.5rem)]", className)}>
      <div className="flex items-center gap-2 rounded-2xl border bg-card/95 p-2 pl-3 shadow-lg backdrop-blur">
        <span className="shrink-0 text-sm font-medium">{count} selected</span>
        {onSelectAll && total != null && count < total && <Button size="sm" variant="link" className="hidden px-1 sm:inline-flex" onClick={onSelectAll}>Select all {total}</Button>}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">{children}</div>
        <Button size="icon-sm" variant="ghost" aria-label="Clear selection" onClick={onClear}><X /></Button>
      </div>
      {message && <p role="status" className={cn("mt-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm shadow", message.error ? "border-destructive/40 text-destructive" : "text-muted-foreground")}>{message.text}</p>}
    </div>
  );
}

