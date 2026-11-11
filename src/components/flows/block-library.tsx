"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { BlockIcon } from "@/components/flows/block-icon";
import { Input } from "@/components/ui/input";
import { CATEGORIES, DESCRIPTIONS } from "@/lib/flows/blocks";
import { BLOCKS, type BlockType } from "@/lib/flows/schema";

// The left panel: every block, grouped and searchable. Drag one onto the
// canvas, or click to add it below the selected block.

export const DRAG_TYPE = "application/x-flow-block";

export function BlockLibrary({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [q, setQ] = useState("");
  const match = (t: BlockType) => !q.trim() || `${BLOCKS[t].label} ${DESCRIPTIONS[t]}`.toLowerCase().includes(q.trim().toLowerCase());
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b p-3">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Block library</p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search blocks" className="h-8 pl-8 text-sm" aria-label="Search blocks" />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {CATEGORIES.map((cat) => {
          const types = cat.types.filter(match);
          if (!types.length) return null;
          return (
            <div key={cat.title} className="space-y-1.5">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{cat.title}</p>
              {types.map((t) => (
                <button key={t} type="button" draggable onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, t); e.dataTransfer.effectAllowed = "move"; }}
                  onClick={() => onAdd(t)}
                  className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border bg-card p-2 text-left transition-colors hover:bg-muted/60 active:cursor-grabbing">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted"><BlockIcon type={t} className="size-3.5" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{BLOCKS[t].label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{DESCRIPTIONS[t]}</span>
                  </span>
                </button>
              ))}
            </div>
          );
        })}
        {CATEGORIES.every((c) => !c.types.some(match)) && <p className="text-sm text-muted-foreground">No blocks match.</p>}
      </div>
    </div>
  );
}
