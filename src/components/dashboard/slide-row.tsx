"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// One row that slides sideways at every screen size: snap points, a fade at
// the edges that have more, and arrow buttons on desktop.
export function SlideRow({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [measure]);
  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * Math.max(240, ref.current.clientWidth * 0.8), behavior: "smooth" });
  const fade = edges.left && edges.right ? "[mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
    : edges.right ? "[mask-image:linear-gradient(to_right,black_94%,transparent)]" : edges.left ? "[mask-image:linear-gradient(to_left,black_94%,transparent)]" : "";
  return (
    <div className={cn("group/row relative", className)}>
      <div ref={ref} onScroll={measure} role="region" aria-label={label} tabIndex={-1}
        className={cn("flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto scroll-px-1 pt-2.5 pr-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", fade)}>
        {children}
      </div>
      {edges.left && (
        <button type="button" onClick={() => go(-1)} aria-label="Scroll left"
          className="absolute top-1/2 left-0 z-10 hidden size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-background shadow-md opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 md:grid">
          <ChevronLeft className="size-4" />
        </button>
      )}
      {edges.right && (
        <button type="button" onClick={() => go(1)} aria-label="Scroll right"
          className="absolute top-1/2 right-0 z-10 hidden size-8 translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-background shadow-md opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 md:grid">
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
