"use client";

import { useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { CARDS, CATEGORIES, CATEGORY_ICON, type Category } from "@/lib/dashboard/cards";
import { CARD_TYPES, type CardType, type Layout } from "@/lib/dashboard/layout";
import { cn } from "@/lib/utils";

// "Add card": every card the dashboard can show, by category, with search.
// Pick which section it goes in (or a new one). Cards you can only have one
// of say "Added" once they're on the dashboard (or "Show" if hidden).

export const NEW_SECTION = "__new__";

export function AddCardPanel({ open, onOpenChange, layout, target, onTarget, onAdd, onShow }: {
  open: boolean; onOpenChange: (o: boolean) => void; layout: Layout; target: string; onTarget: (id: string) => void;
  onAdd: (type: CardType) => void; onShow: (type: CardType) => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const placed = new Map(layout.sections.flatMap((s) => s.cards.map((c) => [c.type, c] as const)));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = CARD_TYPES.filter((t) => {
    const m = CARDS[t];
    if (cat !== "All" && m.category !== cat) return false;
    const text = `${m.title} ${m.what} ${m.category}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });

  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange} id="dashboard-add-card" defaultWidth={560} fullHeight
      title="Add a card" description="Stats, tools, lists, calendars and charts. Drag them anywhere in Customize."
      footer={
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-muted-foreground">Add to</span>
          <Pick label="Section" value={target} onChange={onTarget} className="flex-1"
            options={[...layout.sections.map((s) => ({ value: s.id, label: s.title })), { value: NEW_SECTION, label: "A new section" }]} />
        </div>
      }>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards" aria-label="Search cards" className="pl-9" />
      </div>
      <div className="slide-row -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {(["All", ...CATEGORIES] as const).map((c) => {
          const Icon = c === "All" ? null : CATEGORY_ICON[c];
          return (
            <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", cat === c ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {Icon && <Icon className="size-3.5" />}{c}
            </button>
          );
        })}
      </div>
      {list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No card matches.</p>}
      <div className="grid gap-2">
        {list.map((t) => {
          const m = CARDS[t];
          const on = placed.get(t);
          const added = on && !m.repeat;
          return (
            <div key={t} className="flex gap-3 rounded-xl border bg-card p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><m.icon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">{m.title}<Badge variant="outline" className="h-4 px-1 text-[10px]">{m.category}</Badge></p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{m.what}</p>
              </div>
              {added ? (
                on.hidden ? <Button size="sm" variant="outline" onClick={() => onShow(t)}>Show</Button>
                  : <span className="inline-flex shrink-0 items-center gap-1 self-center text-xs text-muted-foreground"><Check className="size-3.5" /> Added</span>
              ) : (
                <Button size="icon-sm" variant="outline" className="self-center" onClick={() => onAdd(t)} aria-label={`Add ${m.title}`}><Plus /></Button>
              )}
            </div>
          );
        })}
      </div>
    </ResponsivePanel>
  );
}
