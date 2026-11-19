"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Star, Trash2 } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/components/templates/category-slider";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DesignRow } from "@/lib/data";
import { deleteDesign, setDefaultDesign } from "@/lib/designs/actions";
import { normalizeDesign } from "@/lib/designs/schema";
import { TEMPLATE_CATEGORIES, TEMPLATES, type Template } from "@/lib/templates";
import { cn } from "@/lib/utils";

// /templates in the shared list layout: your summary designs (edit, make
// default and delete the ones you own) and the built-in summary templates
// (read-only, so no checkboxes).

const owner = (d: DesignRow) => (d.mine ? (d.workspaceId ? "Shared with your team" : "Only you") : "Shared by a teammate");

// A small picture of the design: page, header with logo, accent, text, footer.
function Swatch({ config, large }: { config: unknown; large?: boolean }) {
  const c = normalizeDesign(config);
  return (
    <div className={cn("overflow-hidden rounded-lg", large ? "w-full p-4" : "size-9 shrink-0 p-1")} style={{ background: c.page.background }}>
      <div className="overflow-hidden rounded-t-[3px]" style={{ background: c.page.content }}>
        <div className={cn("flex items-center gap-2", large ? "h-12 px-3" : "h-2.5 px-0.5")} style={{ background: c.header.background }}>
          {large && (c.logo.url
            // eslint-disable-next-line @next/next/no-img-element -- user logo
            ? <img src={c.logo.url} alt="" className="h-6 w-auto max-w-[6rem] object-contain" />
            : <span className="h-2 w-16 rounded" style={{ background: c.header.textColor, opacity: 0.8 }} />)}
        </div>
        <div className={cn(large ? "space-y-1.5 p-3" : "space-y-0.5 p-0.5")}>
          <span className={cn("block w-3/4 rounded", large ? "h-2" : "h-0.5")} style={{ background: c.page.accent }} />
          <span className={cn("block w-full rounded opacity-30", large ? "h-1.5" : "h-0.5")} style={{ background: c.page.text }} />
          {large && <span className="block h-1.5 w-5/6 rounded opacity-30" style={{ background: c.page.text }} />}
        </div>
        <div className={large ? "h-5" : "h-1"} style={{ background: c.footer.background }} />
      </div>
    </div>
  );
}

export function DesignsCollection({ designs }: { designs: DesignRow[] }) {
  const router = useRouter();
  const run = async (fn: () => Promise<{ error?: string }>) => { const r = await fn(); if (r.error) alert(r.error); router.refresh(); };
  const remove = (rows: DesignRow[]) => {
    const list = rows.filter((d) => d.mine);
    if (!list.length || !confirm(list.length === 1 ? `Delete the design "${list[0].name}"?` : `Delete ${list.length} designs?`)) return;
    return run(async () => { for (const d of list) { const r = await deleteDesign(d.id); if (r.error) return r; } return {}; });
  };
  return (
    <CollectionView<DesignRow>
      items={designs} getId={(d) => d.id} title={(d) => d.name} noun={["design", "designs"]} storageKey="summary-designs" defaultView="cards"
      empty="No summary designs yet."
      subtitle={owner} media={(d) => <Swatch config={d.config} />}
      badge={(d) => (d.isDefault ? <Badge variant="outline">Default</Badge> : null)}
      meta={(d) => <>Edited <LocalDate iso={d.updatedAt} short /></>}
      searchText={(d) => `${d.name} ${owner(d)}`}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "mine", label: "Mine", test: (d) => d.mine },
        { id: "team", label: "From my team", test: (d) => !d.mine || Boolean(d.workspaceId) },
        { id: "default", label: "Default", test: (d) => d.isDefault },
      ]}
      date={(d) => d.updatedAt}
      columns={[
        { id: "name", label: "Design", sort: (d) => d.name.toLowerCase(), cell: (d) => <span className="flex items-center gap-2.5"><Swatch config={d.config} /><span className="font-medium">{d.name}</span></span> },
        { id: "who", label: "Who sees it", sort: owner, cell: (d) => <span className="text-muted-foreground">{owner(d)}</span> },
        { id: "default", label: "Default", sort: (d) => (d.isDefault ? 1 : 0), cell: (d) => (d.isDefault ? <Badge variant="outline">Default</Badge> : <span className="text-muted-foreground">—</span>) },
        { id: "updated", label: "Edited", sort: (d) => d.updatedAt, cell: (d) => <span className="text-muted-foreground"><LocalDate iso={d.updatedAt} short /></span> },
      ]}
      actions={[
        { label: "Edit", icon: Pencil, single: true, show: ([d]) => Boolean(d?.mine), run: ([d]) => router.push(`/templates/designs/${d.id}`) },
        { label: "Make default", icon: Star, single: true, show: ([d]) => Boolean(d?.mine && !d.isDefault), run: ([d]) => run(() => setDefaultDesign(d.id)) },
        { label: "Delete", icon: Trash2, destructive: true, show: (rows) => rows.some((d) => d.mine), run: remove },
      ]}
      previewActions={(d) => d.mine ? (
        <>
          <Button size="sm" nativeButton={false} render={<Link href={`/templates/designs/${d.id}`} />}><Pencil /> Edit</Button>
          {!d.isDefault && <Button size="sm" variant="outline" onClick={() => run(() => setDefaultDesign(d.id))}><Star /> Make default</Button>}
          <Button size="sm" variant="outline" onClick={() => remove([d])}><Trash2 /> Delete</Button>
        </>
      ) : null}
      preview={(d) => (
        <div className="space-y-4 text-sm">
          <Swatch config={d.config} large />
          <dl className="divide-y rounded-xl border px-3">
            {([["Who sees it", owner(d)], ["Default", d.isDefault ? "Yes, new exports use it" : "No"]] as const).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[7rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
            ))}
            <div className="grid grid-cols-[7rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">Edited</dt><dd><LocalDate iso={d.updatedAt} /></dd></div>
          </dl>
          {!d.mine && <p className="text-xs text-muted-foreground">A teammate made this design, so only they can change it.</p>}
        </div>
      )}
    />
  );
}

const icon = (t: Template) => {
  const Icon = CATEGORY_ICONS[t.category];
  return <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Icon className={cn("size-4", CATEGORY_COLORS[t.category])} /></span>;
};

export function TemplatesCollection() {
  return (
    <CollectionView<Template>
      items={TEMPLATES} getId={(t) => t.id} title={(t) => t.name} noun={["template", "templates"]} storageKey="summary-templates" defaultView="cards"
      subtitle={(t) => t.bestFor} media={icon}
      badge={(t) => (t.recommended ? <Badge variant="outline">Recommended</Badge> : null)}
      meta={(t) => `${t.category} · ${t.sections.length} sections`}
      searchText={(t) => `${t.name} ${t.bestFor} ${t.category} ${t.sections.join(" ")}`}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "recommended", label: "Recommended", test: (t) => Boolean(t.recommended) },
        ...TEMPLATE_CATEGORIES.map((c) => ({ id: c, label: c, test: (t: Template) => t.category === c })),
      ]}
      columns={[
        { id: "name", label: "Template", sort: (t) => t.name.toLowerCase(), cell: (t) => <span className="flex items-center gap-2.5">{icon(t)}<span className="font-medium">{t.name}</span></span> },
        { id: "for", label: "Best for", cell: (t) => <span className="line-clamp-1 text-muted-foreground">{t.bestFor}</span> },
        { id: "category", label: "Category", sort: (t) => t.category, cell: (t) => <span className="text-muted-foreground">{t.category}</span> },
        { id: "sections", label: "Sections", sort: (t) => t.sections.length, cell: (t) => <span className="text-muted-foreground tabular-nums">{t.sections.length}</span> },
      ]}
      preview={(t) => (
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">{t.bestFor}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{t.category}</Badge>
            {t.recommended && <Badge variant="outline">Recommended</Badge>}
          </div>
          <ol className="space-y-1.5">
            {t.sections.map((s, i) => <li key={s} className="flex gap-2"><span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span> {s}</li>)}
          </ol>
          <p className="text-xs text-muted-foreground">Every summary also includes highlights with timestamps and action items. Use it from the + next to a recording&apos;s tabs.</p>
        </div>
      )}
    />
  );
}
