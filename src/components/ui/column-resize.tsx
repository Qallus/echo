"use client";

import { useCallback, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// Resizable table columns, shared by every list table in the dashboards.
// Drag a header's right edge to resize; double-click it to reset all columns.
// Widths are remembered per table in this browser. The first drag fixes every
// column at its current width, so the others don't jump around.

const MIN = 56;
const EMPTY: Record<string, number> = {};
const cache = new Map<string, { raw: string | null; value: Record<string, number> }>();

function read(key: string): Record<string, number> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch {}
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value = EMPTY;
  try { const v = raw ? JSON.parse(raw) : null; if (v && typeof v === "object") value = v; } catch {}
  cache.set(key, { raw, value });
  return value;
}

export function useColumnWidths(storageKey: string) {
  const key = `redial.cols.${storageKey}`;
  const widths = useSyncExternalStore(
    (fn) => { window.addEventListener(key, fn); return () => window.removeEventListener(key, fn); },
    () => read(key), () => EMPTY,
  );
  const save = useCallback((next: Record<string, number> | null) => {
    try { if (next) localStorage.setItem(key, JSON.stringify(next)); else localStorage.removeItem(key); } catch {}
    window.dispatchEvent(new Event(key));
  }, [key]);
  const sized = Object.keys(widths).length > 0;
  return {
    sized,
    /** Put on the <table>: fixed layout once any column has been sized. */
    tableStyle: sized ? { tableLayout: "fixed" as const, width: "max-content", minWidth: "100%" } : undefined,
    /** Put on each resizable <th>. */
    width: (id: string) => (widths[id] ? { width: widths[id] } : undefined),
    handle: (id: string) => <ResizeHandle id={id} widths={widths} save={save} />,
  };
}

function ResizeHandle({ id, widths, save }: { id: string; widths: Record<string, number>; save: (w: Record<string, number> | null) => void }) {
  const start = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.closest("th");
    const row = th?.parentElement;
    if (!th || !row) return;
    // Freeze every column at its current width first.
    const base: Record<string, number> = { ...widths };
    row.querySelectorAll<HTMLElement>("th[data-col]").forEach((cell) => { base[cell.dataset.col!] ??= Math.round(cell.getBoundingClientRect().width); });
    const x0 = e.clientX, w0 = base[id] ?? th.getBoundingClientRect().width;
    const move = (ev: PointerEvent) => save({ ...base, [id]: Math.max(MIN, Math.round(w0 + ev.clientX - x0)) });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <span role="separator" aria-orientation="vertical" aria-label="Resize column (double-click to reset)" title="Drag to resize · double-click to reset"
      onPointerDown={start} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); save(null); }}
      className={cn("absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none select-none",
        "after:absolute after:top-1/4 after:right-0.5 after:h-1/2 after:w-px after:bg-border hover:after:w-0.5 hover:after:bg-primary/60")} />
  );
}
