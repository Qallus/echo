"use client";

import { useState } from "react";
import { Copy, GripVertical, ImageIcon, Trash2 } from "lucide-react";
import { BLOCKS, DEFAULT_SETTINGS, applyMerge, blockHtml, type BlockType, type EmailSchema } from "@/lib/comms/blocks";
import { cn } from "@/lib/utils";

// Drag types: a new block from the palette, or an existing block being moved.
export const NEW_BLOCK = "application/x-echo-block";
const MOVE_BLOCK = "application/x-echo-move";

type Props = {
  schema: EmailSchema;
  sample: Record<string, string>;
  device: "desktop" | "phone";
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMove: (from: number, to: number) => void;
  onInsert: (type: BlockType, at: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (id: string) => void;
};

// The email drawn block by block. Click a block to edit it on the right,
// drag it to move it, or use its corner tools to copy or delete it. Blocks
// from the palette can be dropped anywhere between blocks.
export function EmailCanvas({ schema, sample, device, selected, onSelect, onMove, onInsert, onDuplicate, onDelete }: Props) {
  const [drop, setDrop] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const s = { ...DEFAULT_SETTINGS, ...schema.settings };
  const blocks = schema.blocks;

  const over = (e: React.DragEvent, i: number) => {
    if (![...e.dataTransfer.types].some((t) => t === NEW_BLOCK || t === MOVE_BLOCK)) return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setDrop(e.clientY < r.top + r.height / 2 ? i : i + 1);
  };
  const dropped = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const at = drop ?? blocks.length;
    const type = e.dataTransfer.getData(NEW_BLOCK) as BlockType;
    if (type && type in BLOCKS) onInsert(type, at);
    else if (dragging !== null) onMove(dragging, at > dragging ? at - 1 : at);
    setDrop(null); setDragging(null);
  };
  const line = (i: number) => drop === i && <div className="pointer-events-none relative z-10 -my-px h-0.5 bg-primary" aria-hidden />;

  return (
    <div
      className="min-h-full px-3 py-6"
      style={{ background: s.backgroundColor }}
      onClick={() => onSelect(null)}
      onDragOver={(e) => { if ([...e.dataTransfer.types].some((t) => t === NEW_BLOCK || t === MOVE_BLOCK)) { e.preventDefault(); setDrop(blocks.length); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null); }}
      onDrop={dropped}
    >
      <div
        className="mx-auto overflow-hidden rounded-xl border border-zinc-200"
        style={{ width: device === "phone" ? 380 : s.width, maxWidth: "100%", background: s.contentColor, fontFamily: s.fontFamily, color: s.textColor }}
        onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) e.preventDefault(); }}
      >
        {blocks.map((b, i) => {
          const html = blockHtml(b, s);
          const active = selected === b.id;
          return (
            <div key={b.id}>
              {line(i)}
              <div
                role="button"
                tabIndex={0}
                aria-label={`${BLOCKS[b.type].label} block`}
                aria-pressed={active}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData(MOVE_BLOCK, String(i)); e.dataTransfer.effectAllowed = "move"; setDragging(i); }}
                onDragEnd={() => { setDragging(null); setDrop(null); }}
                onDragOver={(e) => over(e, i)}
                onDrop={dropped}
                onClick={(e) => { e.stopPropagation(); onSelect(b.id); }}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(b.id); }
                  if (e.key === "Delete") onDelete(b.id);
                  if (e.altKey && e.key === "ArrowUp" && i > 0) { e.preventDefault(); onMove(i, i - 1); }
                  if (e.altKey && e.key === "ArrowDown" && i < blocks.length - 1) { e.preventDefault(); onMove(i, i + 1); }
                }}
                className={cn(
                  "group relative cursor-pointer outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-primary",
                  active ? "outline-2 outline-primary" : "hover:outline-1 hover:outline-dashed hover:outline-primary/60",
                  dragging === i && "opacity-40",
                )}
              >
                {html
                  ? <div dangerouslySetInnerHTML={{ __html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${applyMerge(html, sample, true)}</table>` }} />
                  : <div className="m-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 p-6 text-xs text-zinc-500"><ImageIcon className="size-4" /> Upload an image on the right</div>}
                <div className={cn("absolute top-1 right-1 z-10 items-center gap-0.5 rounded-md bg-primary p-0.5 text-primary-foreground shadow-sm", active ? "flex" : "hidden group-hover:flex group-focus-within:flex")}>
                  <span className="px-1.5 text-[10px] font-semibold lowercase">{BLOCKS[b.type].label}</span>
                  <span className="cursor-grab rounded p-0.5 hover:bg-white/20" title="Drag to move" aria-hidden><GripVertical className="size-3.5" /></span>
                  <button type="button" className="rounded p-0.5 hover:bg-white/20" aria-label={`Duplicate ${BLOCKS[b.type].label}`} onClick={(e) => { e.stopPropagation(); onDuplicate(i); }}><Copy className="size-3.5" /></button>
                  <button type="button" className="rounded p-0.5 hover:bg-red-500" aria-label={`Delete ${BLOCKS[b.type].label}`} onClick={(e) => { e.stopPropagation(); onDelete(b.id); }}><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
        {line(blocks.length)}
        {blocks.length === 0 && <p className="p-10 text-center text-sm text-zinc-500">Drag a block here, or click one on the left.</p>}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">{blocks.length} block{blocks.length === 1 ? "" : "s"} · shown with an example contact</p>
    </div>
  );
}
