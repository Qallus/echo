"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen, Briefcase, ChartLine, ChevronLeft, ChevronRight, GraduationCap, Handshake, HardHat, House, LayoutGrid, LifeBuoy,
  MessagesSquare, Mic, MonitorSmartphone, Phone, Scale, Sparkles, Star, Stethoscope, Users,
} from "lucide-react";
import type { TemplateCategory } from "@/lib/templates";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS: Record<TemplateCategory, typeof Users> = {
  General: Sparkles, Meeting: Users, Speech: Mic, Call: Phone, Interview: MessagesSquare, Medical: Stethoscope,
  Sales: Handshake, Consulting: Briefcase, Education: GraduationCap, Construction: HardHat,
  "IT & Engineering": MonitorSmartphone, Legal: Scale, "Real Estate": House, Financial: ChartLine,
  Support: LifeBuoy, Faith: BookOpen, Functional: LayoutGrid,
};

// Icon tint on template cards, so categories are easy to tell apart.
export const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  General: "text-violet-500", Meeting: "text-sky-500", Speech: "text-pink-500", Call: "text-emerald-500",
  Interview: "text-indigo-500", Medical: "text-rose-500", Sales: "text-amber-500", Consulting: "text-teal-500",
  Education: "text-blue-500", Construction: "text-orange-500", "IT & Engineering": "text-cyan-500", Legal: "text-slate-500",
  "Real Estate": "text-lime-600", Financial: "text-green-600", Support: "text-fuchsia-500", Faith: "text-yellow-600",
  Functional: "text-zinc-500",
};

export type CategoryFilter = "Recommended" | "All" | TemplateCategory;

// A row of category chips that scrolls sideways, with arrow buttons when it
// overflows (swipe on touch screens).
export function CategorySlider({ value, onChange, categories, className }: {
  value: CategoryFilter | null; onChange: (c: CategoryFilter) => void; categories: CategoryFilter[]; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: "smooth" });
  const arrow = "absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted sm:flex";

  return (
    <div className={cn("relative min-w-0", className)}>
      {edges.left && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-12 bg-gradient-to-r from-background to-transparent" />
          <button type="button" aria-label="Scroll categories left" onClick={() => scroll(-1)} className={cn(arrow, "left-0")}><ChevronLeft className="size-4" /></button>
        </>
      )}
      <div ref={ref} className="flex snap-x gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((c) => {
          const Icon = c === "Recommended" ? Star : c === "All" ? LayoutGrid : CATEGORY_ICONS[c];
          const active = value === c;
          return (
            <button key={c} type="button" aria-pressed={active} onClick={() => onChange(c)}
              className={cn("flex shrink-0 snap-start items-center gap-2 rounded-lg border px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
                active ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted")}>
              <Icon className="size-4" /> {c}
            </button>
          );
        })}
      </div>
      {edges.right && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-12 bg-gradient-to-l from-background to-transparent" />
          <button type="button" aria-label="Scroll categories right" onClick={() => scroll(1)} className={cn(arrow, "right-0")}><ChevronRight className="size-4" /></button>
        </>
      )}
    </div>
  );
}
