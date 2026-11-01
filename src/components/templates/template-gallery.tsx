"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TEMPLATE_CATEGORIES, TEMPLATES, type Template } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategorySlider, type CategoryFilter } from "./category-slider";

export const FILTERS: CategoryFilter[] = ["Recommended", "All", ...TEMPLATE_CATEGORIES];

export function filterTemplates(query: string, filter: CategoryFilter) {
  const q = query.trim().toLowerCase();
  return TEMPLATES.filter((t) =>
    q ? `${t.name} ${t.bestFor} ${t.category} ${t.sections.join(" ")}`.toLowerCase().includes(q)
      : filter === "Recommended" ? t.recommended : filter === "All" ? true : t.category === filter);
}

export function TemplateCard({ t, active, onClick, onDoubleClick }: { t: Template; active?: boolean; onClick: () => void; onDoubleClick?: () => void }) {
  const Icon = CATEGORY_ICONS[t.category];
  return (
    <button type="button" onClick={onClick} onDoubleClick={onDoubleClick} aria-pressed={active}
      className={cn("flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40",
        active && "border-foreground ring-1 ring-foreground")}>
      <Icon className={cn("size-5", CATEGORY_COLORS[t.category])} />
      <span className="mt-1 font-medium">{t.name}</span>
      <span className="text-sm text-muted-foreground">{t.bestFor}</span>
      <span className="mt-auto pt-2 text-xs text-muted-foreground">{t.category} · {t.sections.length} sections</span>
    </button>
  );
}

// /templates: browse every summary template by category.
export function TemplateGallery() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CategoryFilter>("All");
  const [open, setOpen] = useState<Template | null>(null);
  const shown = filterTemplates(query, filter);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${TEMPLATES.length} templates`} className="pl-8" aria-label="Search templates" />
      </div>
      <CategorySlider categories={FILTERS} value={query.trim() ? null : filter} onChange={(c) => { setFilter(c); setQuery(""); }} />
      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No templates match “{query}”.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => <TemplateCard key={t.id} t={t} onClick={() => setOpen(t)} />)}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <DialogContent title={open.name} description={open.bestFor} className="max-w-md">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{open.category}</Badge>
              {open.recommended && <Badge variant="outline">Recommended</Badge>}
            </div>
            <ol className="space-y-1.5 text-sm">
              {open.sections.map((s, i) => (
                <li key={s} className="flex gap-2"><span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span> {s}</li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">Every summary also includes highlights with timestamps and action items. Use it from the + next to a recording&apos;s tabs.</p>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
