"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { FEATURE_GROUPS, visibleFeatures } from "@/lib/features";

const norm = (s: string) => s.toLowerCase();

// "All features": every feature in one slide-out (side sheet on desktop,
// bottom sheet on phones), grouped like the sidebar, with search. Columns
// follow the panel's own width (container queries): drag it wider for a
// third column, narrower for one.
export function FeatureMenu({ open, onOpenChange, line, liveAgent, crmReady = false }: { open: boolean; onOpenChange: (o: boolean) => void; line: boolean; liveAgent: boolean; crmReady?: boolean }) {
  const [q, setQ] = useState("");
  const words = norm(q).split(/\s+/).filter(Boolean);
  const list = visibleFeatures({ line, liveAgent, crmReady }).filter((f) => {
    const text = norm(`${f.title} ${f.what} ${f.group} ${f.keywords ?? ""}`);
    return words.every((w) => text.includes(w));
  });
  const close = () => { onOpenChange(false); setQ(""); };

  return (
    <ResponsivePanel open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())} id="feature-menu" defaultWidth={560} fullHeight bodyClassName="@container"
      title="All features" description="Everything Redial can do, and where to find it.">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search features" aria-label="Search features" className="pl-9" />
      </div>
      {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No feature matches. Try Ask Echo.</p>}
      {FEATURE_GROUPS.map((g) => {
        const items = list.filter((f) => f.group === g);
        if (!items.length) return null;
        return (
          <section key={g} className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{g}</h3>
            <div className="grid gap-2 @md:grid-cols-2 @2xl:grid-cols-3">
              {items.map(({ title, href, icon: Icon, what, soon }) => (
                <Link key={title} href={href} onClick={close}
                  className="flex gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Icon className="size-4" /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium">{title}{soon && <Badge variant="outline" className="h-4 px-1 text-[10px]">Soon</Badge>}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{what}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </ResponsivePanel>
  );
}
