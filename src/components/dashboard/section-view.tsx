"use client";

import { useDroppable } from "@dnd-kit/core";
import { horizontalListSortingStrategy, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Columns3, EyeOff, GripVertical, LayoutGrid, Plus, Rows3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Section } from "@/lib/dashboard/layout";
import { cn } from "@/lib/utils";
import { SlideRow } from "./slide-row";

// A section: its header (title, collapse, hide; in Customize also rename,
// row or grid, delete and a drag handle) and its cards, in one row that
// slides sideways or in a grid.

export function SectionView({ section, edit, children, onChange, onRemove, onAdd }: {
  section: Section; edit: boolean; children: React.ReactNode;
  onChange: (patch: Partial<Section>) => void; onRemove: () => void; onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id, data: { kind: "section" }, disabled: !edit,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `drop:${section.id}`, data: { kind: "drop", section: section.id }, disabled: !edit });
  const visible = edit ? section.cards : section.cards.filter((c) => !c.hidden);
  if (!edit && (section.hidden || !visible.length)) return null;
  const ids = section.cards.map((c) => c.id);

  return (
    <section ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} aria-label={section.title}
      className={cn("space-y-2.5", isDragging && "z-30 opacity-70", edit && "rounded-2xl border border-dashed p-3", edit && section.hidden && "opacity-50")}>
      <header className="flex min-h-8 items-center gap-1.5">
        {edit && (
          <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Move section ${section.title}`}
            className="grid size-7 cursor-grab touch-none place-items-center rounded-md hover:bg-muted active:cursor-grabbing"><GripVertical className="size-4" /></button>
        )}
        {edit ? (
          <Input value={section.title} onChange={(e) => onChange({ title: e.target.value.slice(0, 60) })} aria-label="Section name" className="h-8 max-w-56 text-sm font-semibold" />
        ) : (
          <button type="button" onClick={() => onChange({ collapsed: !section.collapsed })} aria-expanded={!section.collapsed}
            className="flex items-center gap-1 text-sm font-semibold tracking-tight hover:text-muted-foreground">
            {section.title}<ChevronDown className={cn("size-4 transition-transform", section.collapsed && "-rotate-90")} />
          </button>
        )}
        <span className="flex-1" />
        {edit ? (
          <>
            <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="Layout">
              <button type="button" role="radio" aria-checked={section.style === "row"} onClick={() => onChange({ style: "row" })} title="One row that slides"
                className={cn("grid size-7 place-items-center rounded-md", section.style === "row" ? "bg-muted" : "text-muted-foreground")}><Columns3 className="size-3.5" /></button>
              <button type="button" role="radio" aria-checked={section.style === "grid"} onClick={() => onChange({ style: "grid" })} title="Grid"
                className={cn("grid size-7 place-items-center rounded-md", section.style === "grid" ? "bg-muted" : "text-muted-foreground")}><LayoutGrid className="size-3.5" /></button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onChange({ hidden: !section.hidden })}>{section.hidden ? "Show" : "Hide"}</Button>
            <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Delete section" title="Delete section" className="text-destructive"><Trash2 /></Button>
          </>
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={() => onChange({ hidden: true })} aria-label={`Hide ${section.title}`} title="Hide section"
            className="text-muted-foreground"><EyeOff /></Button>
        )}
      </header>

      {!section.collapsed && (
        <div ref={setDropRef} className={cn(edit && isOver && "rounded-xl bg-primary/5 ring-2 ring-primary/30")}>
          <SortableContext items={ids} strategy={section.style === "row" ? horizontalListSortingStrategy : rectSortingStrategy}>
            {section.style === "row" ? (
              <SlideRow label={section.title}>{children}{edit && <AddTile onAdd={onAdd} row />}</SlideRow>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 lg:grid-cols-12">{children}{edit && <AddTile onAdd={onAdd} />}</div>
            )}
          </SortableContext>
        </div>
      )}
      {edit && !section.collapsed && !section.cards.length && <p className="text-xs text-muted-foreground"><Rows3 className="mr-1 inline size-3.5" />Drag cards here, or add one.</p>}
    </section>
  );
}

function AddTile({ onAdd, row }: { onAdd: () => void; row?: boolean }) {
  return (
    <button type="button" onClick={onAdd}
      className={cn("flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground",
        row ? "w-40 shrink-0 snap-start" : "col-span-1 sm:col-span-2")}>
      <Plus className="size-5" /> Add card
    </button>
  );
}
