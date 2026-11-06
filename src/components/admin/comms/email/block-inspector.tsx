"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BLOCKS, MERGE_FIELDS, createBlock, type EmailBlock, type EmailSettings } from "@/lib/comms/blocks";
import { Pick } from "./pick";

export function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <F label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value ?? "#000000"} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border bg-transparent" aria-label={label} />
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-xs" />
      </div>
    </F>
  );
}
function NumField({ label, value, onChange, max = 200 }: { label: string; value?: number; onChange: (v: number) => void; max?: number }) {
  return <F label={label}><Input type="number" min={0} max={max} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} className="h-8" /></F>;
}
function MergeChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {MERGE_FIELDS.slice(0, 8).map((m) => <button key={m.token} type="button" onClick={() => onInsert(m.token)} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">{m.label}</button>)}
    </div>
  );
}

const ALIGN = [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }] as const;
const FONTS = [
  { value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", label: "System (modern)" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "'Trebuchet MS', Helvetica, sans-serif", label: "Trebuchet" },
] as const;

// The settings for whichever block is selected.
export function BlockInspector({ b, set }: { b: EmailBlock; set: (patch: Partial<EmailBlock>) => void }) {
  const alignField = <F label="Align"><Pick label="Align" value={b.align ?? "left"} onChange={(align) => set({ align })} options={ALIGN} /></F>;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{BLOCKS[b.type].label}</p>
      {b.type === "header" && <>
        <F label="Brand text"><Input value={b.title ?? ""} onChange={(e) => set({ title: e.target.value })} className="h-8" /></F>
        <F label="Logo URL (https, optional)"><Input value={b.url ?? ""} onChange={(e) => set({ url: e.target.value })} className="h-8" placeholder="https://…/logo.png" /></F>
        <ColorField label="Background" value={b.backgroundColor} onChange={(v) => set({ backgroundColor: v })} />
        {alignField}
      </>}
      {(b.type === "heading" || b.type === "text" || b.type === "footer") && <>
        <F label="Text">
          {b.type === "heading" ? <Input value={b.text ?? ""} onChange={(e) => set({ text: e.target.value })} className="h-8" />
            : <Textarea rows={b.type === "text" ? 6 : 3} value={b.text ?? ""} onChange={(e) => set({ text: e.target.value })} />}
        </F>
        {b.type !== "footer" ? <MergeChips onInsert={(t) => set({ text: `${b.text ?? ""}${t}` })} /> : <p className="text-xs text-muted-foreground">An Unsubscribe link is always added under the footer.</p>}
        <div className="grid grid-cols-2 gap-2"><NumField label="Size" value={b.fontSize} max={60} onChange={(v) => set({ fontSize: v })} />{alignField}</div>
        <ColorField label="Color" value={b.textColor} onChange={(v) => set({ textColor: v })} />
      </>}
      {b.type === "button" && <>
        <F label="Label"><Input value={b.text ?? ""} onChange={(e) => set({ text: e.target.value })} className="h-8" /></F>
        <F label="Link"><Input value={b.linkUrl ?? ""} onChange={(e) => set({ linkUrl: e.target.value })} className="h-8" placeholder="https://" /></F>
        <ColorField label="Button" value={b.buttonColor} onChange={(v) => set({ buttonColor: v })} />
        <ColorField label="Label color" value={b.buttonTextColor} onChange={(v) => set({ buttonTextColor: v })} />
        {alignField}
      </>}
      {b.type === "image" && <>
        <F label="Image URL (https)"><Input value={b.url ?? ""} onChange={(e) => set({ url: e.target.value })} className="h-8" placeholder="https://…" /></F>
        <F label="Alt text (read aloud, and shown if images are off)"><Input value={b.alt ?? ""} onChange={(e) => set({ alt: e.target.value })} className="h-8" /></F>
        <F label="Link (optional)"><Input value={b.linkUrl ?? ""} onChange={(e) => set({ linkUrl: e.target.value })} className="h-8" /></F>
        <div className="grid grid-cols-2 gap-2"><NumField label="Width" value={b.width} max={800} onChange={(v) => set({ width: v })} />{alignField}</div>
      </>}
      {b.type === "divider" && <ColorField label="Line color" value={b.dividerColor} onChange={(v) => set({ dividerColor: v })} />}
      {b.type === "spacer" && <NumField label="Height" value={b.height} max={300} onChange={(v) => set({ height: v })} />}
      {b.type === "columns" && <>
        <F label="Columns">
          <Pick label="Number of columns" value={String((b.columns ?? []).length || 2) as "2" | "3"} options={[{ value: "2", label: "Two" }, { value: "3", label: "Three" }]}
            onChange={(n) => { const cols = b.columns ?? []; set({ columns: n === "3" ? [...cols.slice(0, 3), ...Array.from({ length: Math.max(0, 3 - cols.length) }, () => ({ blocks: [createBlock("text")] }))] : cols.slice(0, 2) }); }} />
        </F>
        {(b.columns ?? []).map((c, i) => (
          <F key={i} label={`Column ${i + 1}`}>
            <Textarea rows={4} value={c.blocks[0]?.text ?? ""}
              onChange={(e) => set({ columns: (b.columns ?? []).map((col, k) => (k === i ? { blocks: [{ ...(col.blocks[0] ?? createBlock("text")), text: e.target.value }] } : col)) })} />
          </F>
        ))}
      </>}
      {b.type !== "spacer" && (
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Top" value={b.padTop} onChange={(v) => set({ padTop: v })} />
          <NumField label="Bottom" value={b.padBottom} onChange={(v) => set({ padBottom: v })} />
          <NumField label="Sides" value={b.padX} onChange={(v) => set({ padX: v })} />
        </div>
      )}
    </div>
  );
}

// The whole email's look, when no block is selected.
export function StyleInspector({ s, set }: { s: EmailSettings; set: (patch: Partial<EmailSettings>) => void }) {
  const font = FONTS.find((f) => f.value === s.fontFamily)?.value ?? FONTS[0].value;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Email style</p>
      <F label="Font"><Pick label="Font" value={font} onChange={(fontFamily) => set({ fontFamily })} options={FONTS} /></F>
      <NumField label="Width (px)" value={s.width} max={800} onChange={(width) => set({ width })} />
      <ColorField label="Page background" value={s.backgroundColor} onChange={(backgroundColor) => set({ backgroundColor })} />
      <ColorField label="Card background" value={s.contentColor} onChange={(contentColor) => set({ contentColor })} />
      <ColorField label="Text color" value={s.textColor} onChange={(textColor) => set({ textColor })} />
      <p className="text-xs text-muted-foreground">Select a block to edit it.</p>
    </div>
  );
}
