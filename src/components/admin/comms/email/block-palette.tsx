"use client";

import {
  BadgeCheck, Columns2, Heading, HelpCircle, Image as ImageIcon, LayoutGrid, List, Megaphone, Minus, MousePointerClick, MoveVertical, PanelBottom,
  PanelLeftClose, PanelLeftOpen, PanelTop, PenLine, Quote, Rows3, Share2, SquareStack, Table2, Tag, Ticket, TrendingUp, Type, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BLOCKS, BLOCK_GROUPS, type BlockType } from "@/lib/comms/blocks";
import { cn } from "@/lib/utils";
import { NEW_BLOCK } from "./email-canvas";

export const ICONS: Record<BlockType, typeof Type> = {
  header: PanelTop, heading: Heading, text: Type, button: MousePointerClick, image: ImageIcon, columns: Columns2, divider: Minus, spacer: MoveVertical, footer: PanelBottom,
  buttons: SquareStack, card: BadgeCheck, list: List, quote: Quote, callout: Megaphone, badge: Tag, stats: TrendingUp, details: Table2, faq: HelpCircle,
  social: Share2, video: Video, code: Ticket, signature: PenLine,
};

// The "Add a block" column. Click a block to add it under the selected one,
// or drag it into the email. One or two per row; collapsed, it's a strip of
// icons that still click and drag.
export function BlockPalette({ cols, setCols, collapsed, onToggle, onAdd }: {
  cols: 1 | 2; setCols: (c: 1 | 2) => void; collapsed: boolean; onToggle: () => void; onAdd: (t: BlockType) => void;
}) {
  const drag = (t: BlockType) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData(NEW_BLOCK, t); e.dataTransfer.effectAllowed = "copy"; },
    onClick: () => onAdd(t),
    title: `${BLOCKS[t].label}: click to add, or drag into the email`,
  });

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-0.5 py-2">
        <Button size="icon-sm" variant="ghost" aria-label="Expand blocks" title="Expand blocks" onClick={onToggle}><PanelLeftOpen /></Button>
        {BLOCK_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col items-center gap-0.5 border-t py-1 first-of-type:border-t-0">
            {g.types.map((t) => { const Icon = ICONS[t]; return (
              <button key={t} type="button" {...drag(t)} aria-label={`Add ${BLOCKS[t].label}`} className="flex size-8 cursor-grab items-center justify-center rounded-md text-primary hover:bg-muted"><Icon className="size-4" /></button>
            ); })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="mb-1 flex items-center gap-1 px-1">
        <h3 className="flex-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Add a block</h3>
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Blocks per row">
          <Button size="icon-xs" variant={cols === 1 ? "secondary" : "ghost"} aria-label="One per row" aria-pressed={cols === 1} onClick={() => setCols(1)}><Rows3 /></Button>
          <Button size="icon-xs" variant={cols === 2 ? "secondary" : "ghost"} aria-label="Two per row" aria-pressed={cols === 2} onClick={() => setCols(2)}><LayoutGrid /></Button>
        </div>
        <Button size="icon-xs" variant="ghost" aria-label="Collapse blocks" title="Collapse" onClick={onToggle}><PanelLeftClose /></Button>
      </div>
      {BLOCK_GROUPS.map((g) => (
        <div key={g.label} className="mb-2">
          <h4 className="px-2 pt-1 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase">{g.label}</h4>
          <div className={cn("grid gap-1", cols === 2 ? "grid-cols-2" : "grid-cols-1")}>
            {g.types.map((t) => {
              const Icon = ICONS[t];
              return cols === 2 ? (
                <button key={t} type="button" {...drag(t)} className="flex cursor-grab flex-col items-center gap-1 rounded-lg border bg-background px-1 py-2 text-center hover:border-primary/50 hover:bg-muted active:cursor-grabbing">
                  <Icon className="size-4 text-primary" /><span className="text-xs leading-tight font-medium">{BLOCKS[t].label}</span>
                </button>
              ) : (
                <button key={t} type="button" {...drag(t)} className="flex w-full cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted active:cursor-grabbing">
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0"><span className="block text-sm font-medium">{BLOCKS[t].label}</span><span className="block truncate text-[11px] text-muted-foreground">{BLOCKS[t].hint}</span></span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
