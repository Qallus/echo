"use client";

import { AlignCenter, AlignLeft, AlignRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CALLOUTS, createBlock, type Align, type BlockItem, type EmailBlock, type EmailSettings } from "@/lib/comms/blocks";
import { cn } from "@/lib/utils";
import { LogoField } from "./logo-field";
import { Pick, cap } from "./pick";

export function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-3 border-t pt-3 first:border-t-0 first:pt-0"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>{children}</div>;
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
function TextField({ label, value, onChange, placeholder, rows }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <F label={label}>
      {rows ? <Textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        : <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-8" placeholder={placeholder} />}
    </F>
  );
}
const ALIGNS: { value: Align; icon: typeof AlignLeft }[] = [{ value: "left", icon: AlignLeft }, { value: "center", icon: AlignCenter }, { value: "right", icon: AlignRight }];
function AlignField({ value, onChange }: { value?: Align; onChange: (v: Align) => void }) {
  return (
    <F label="Alignment">
      <div className="flex gap-1" role="group" aria-label="Alignment">
        {ALIGNS.map(({ value: v, icon: Icon }) => (
          <Button key={v} type="button" size="icon-sm" variant={(value ?? "left") === v ? "secondary" : "outline"} aria-label={cap(v)} aria-pressed={(value ?? "left") === v} onClick={() => onChange(v)}><Icon /></Button>
        ))}
      </div>
    </F>
  );
}

// Rows for list, stats, details, FAQ and social blocks.
function ItemsField({ items, set, label, value, url, max = 20 }: { items?: BlockItem[]; set: (items: BlockItem[]) => void; label: string; value?: string; url?: string; max?: number }) {
  const list = items ?? [];
  const patch = (i: number, p: Partial<BlockItem>) => set(list.map((it, k) => (k === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-2">
      {list.map((it, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border p-2">
          <div className="flex items-center gap-1">
            <Input value={it.label} onChange={(e) => patch(i, { label: e.target.value })} className="h-8" placeholder={label} aria-label={`${label} ${i + 1}`} />
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${i + 1}`} onClick={() => set(list.filter((_, k) => k !== i))}><X /></Button>
          </div>
          {value !== undefined && <Textarea rows={2} value={it.value ?? ""} onChange={(e) => patch(i, { value: e.target.value })} placeholder={value} aria-label={`${value} ${i + 1}`} />}
          {url !== undefined && <Input value={it.url ?? ""} onChange={(e) => patch(i, { url: e.target.value })} className="h-8" placeholder={url} aria-label={`${url} ${i + 1}`} />}
        </div>
      ))}
      {list.length < max && <Button type="button" size="sm" variant="outline" onClick={() => set([...list, { label: "" }])}><Plus /> Add</Button>}
    </div>
  );
}

// The settings for whichever block is selected.
export function BlockInspector({ b, set }: { b: EmailBlock; set: (patch: Partial<EmailBlock>) => void }) {
  const t = b.type;
  const align = <AlignField value={b.align} onChange={(align) => set({ align })} />;
  const textColor = <ColorField label="Text color" value={b.textColor} onChange={(v) => set({ textColor: v })} />;
  const buttonColors = <>
    <ColorField label="Button color" value={b.buttonColor} onChange={(v) => set({ buttonColor: v })} />
    <ColorField label="Button text" value={b.buttonTextColor} onChange={(v) => set({ buttonTextColor: v })} />
  </>;
  return (
    <div className="space-y-4">
      <Group label="Content">
        {t === "header" && <>
          <LogoField b={b} set={set} />
          {b.url && <>
            <TextField label="Logo alt text (read aloud, shown if images are off)" value={b.alt} onChange={(alt) => set({ alt })} />
            <NumField label="Logo height (px)" value={b.height ?? 28} max={120} onChange={(height) => set({ height })} />
          </>}
          <TextField label={b.url ? "Text beside the logo (optional)" : "Brand text"} value={b.title} onChange={(title) => set({ title })} />
        </>}
        {t === "heading" && <TextField label="Text" value={b.text} onChange={(text) => set({ text })} rows={2} />}
        {(t === "text" || t === "footer") && <TextField label="Text" value={b.text} onChange={(text) => set({ text })} rows={t === "text" ? 7 : 3} />}
        {t === "footer" && <p className="text-xs text-muted-foreground">An Unsubscribe link is always added under the footer.</p>}
        {(t === "button" || t === "buttons") && <>
          <TextField label={t === "buttons" ? "Main button" : "Label"} value={b.text} onChange={(text) => set({ text })} />
          <TextField label="Link" value={b.linkUrl} onChange={(linkUrl) => set({ linkUrl })} placeholder="https://" />
        </>}
        {t === "buttons" && <>
          <TextField label="Outline button (blank to hide)" value={b.label} onChange={(label) => set({ label })} />
          <TextField label="Outline link" value={b.secondaryUrl} onChange={(secondaryUrl) => set({ secondaryUrl })} placeholder="https://" />
        </>}
        {(t === "image" || t === "card" || t === "video") && <>
          <TextField label={t === "video" ? "Thumbnail URL (https, optional)" : `Image URL (https${t === "card" ? ", optional" : ""})`} value={b.url} onChange={(url) => set({ url })} placeholder="https://…" />
          <TextField label="Alt text (read aloud, shown if images are off)" value={b.alt} onChange={(alt) => set({ alt })} />
        </>}
        {t === "image" && <TextField label="Link (optional)" value={b.linkUrl} onChange={(linkUrl) => set({ linkUrl })} placeholder="https://" />}
        {t === "video" && <>
          <TextField label="Video link" value={b.linkUrl} onChange={(linkUrl) => set({ linkUrl })} placeholder="https://youtube.com/…" />
          <TextField label="Caption" value={b.text} onChange={(text) => set({ text })} />
          <p className="text-xs text-muted-foreground">Email can&apos;t play video, so this shows the thumbnail and opens the video when clicked.</p>
        </>}
        {t === "card" && <>
          <TextField label="Title" value={b.title} onChange={(title) => set({ title })} />
          <TextField label="Text" value={b.text} onChange={(text) => set({ text })} rows={3} />
          <TextField label="Button label (blank to hide)" value={b.label} onChange={(label) => set({ label })} />
          <TextField label="Button link" value={b.linkUrl} onChange={(linkUrl) => set({ linkUrl })} placeholder="https://" />
        </>}
        {t === "list" && <>
          <ItemsField items={b.items} set={(items) => set({ items })} label="Item" />
          <F label="Style"><Pick label="List style" value={b.ordered ? "numbers" : "bullets"} onChange={(v) => set({ ordered: v === "numbers" })} options={[{ value: "bullets", label: "Bullets" }, { value: "numbers", label: "Numbers" }]} /></F>
        </>}
        {t === "quote" && <>
          <TextField label="Quote" value={b.text} onChange={(text) => set({ text })} rows={3} />
          <TextField label="Name" value={b.title} onChange={(title) => set({ title })} />
          <TextField label="Role or company" value={b.label} onChange={(label) => set({ label })} />
          <TextField label="Photo URL (https, optional)" value={b.url} onChange={(url) => set({ url })} placeholder="https://…" />
        </>}
        {t === "callout" && <>
          <TextField label="Title (optional)" value={b.title} onChange={(title) => set({ title })} />
          <TextField label="Text" value={b.text} onChange={(text) => set({ text })} rows={3} />
          <F label="Look">
            <div className="flex flex-wrap gap-1">
              {(Object.keys(CALLOUTS) as (keyof typeof CALLOUTS)[]).map((k) => (
                <button key={k} type="button" onClick={() => set({ ...CALLOUTS[k] })} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                  <span className="size-3 rounded-full border" style={{ background: CALLOUTS[k].backgroundColor, borderColor: CALLOUTS[k].borderColor }} /> {cap(k)}
                </button>
              ))}
            </div>
          </F>
        </>}
        {t === "badge" && <TextField label="Text" value={b.text} onChange={(text) => set({ text })} />}
        {t === "stats" && <ItemsField items={b.items} set={(items) => set({ items })} label="Label" value="Number" max={4} />}
        {t === "details" && <>
          <TextField label="Title (optional)" value={b.title} onChange={(title) => set({ title })} />
          <ItemsField items={b.items} set={(items) => set({ items })} label="Label" value="Value" />
        </>}
        {t === "faq" && <ItemsField items={b.items} set={(items) => set({ items })} label="Question" value="Answer" />}
        {t === "social" && <ItemsField items={b.items} set={(items) => set({ items })} label="Name, like LinkedIn" url="https://…" max={8} />}
        {t === "code" && <>
          <TextField label="Code" value={b.text} onChange={(text) => set({ text })} />
          <TextField label="Above the code (optional)" value={b.title} onChange={(title) => set({ title })} />
          <TextField label="Below the code (optional)" value={b.label} onChange={(label) => set({ label })} placeholder="Expires Dec 31" />
        </>}
        {t === "signature" && <>
          <TextField label="Name" value={b.title} onChange={(title) => set({ title })} />
          <TextField label="Role" value={b.label} onChange={(label) => set({ label })} />
          <TextField label="Contact lines" value={b.text} onChange={(text) => set({ text })} rows={2} />
          <TextField label="Photo URL (https, optional)" value={b.url} onChange={(url) => set({ url })} placeholder="https://…" />
        </>}
        {t === "columns" && <>
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
        {t === "divider" && <ColorField label="Line color" value={b.dividerColor} onChange={(v) => set({ dividerColor: v })} />}
        {t === "spacer" && <NumField label="Height (px)" value={b.height} max={300} onChange={(v) => set({ height: v })} />}
      </Group>

      {t !== "spacer" && t !== "divider" && (
        <Group label="Style">
          {["heading", "text", "footer", "list", "quote", "callout", "stats"].includes(t) && <NumField label="Font size (px)" value={b.fontSize} max={60} onChange={(v) => set({ fontSize: v })} />}
          {(t === "image" || t === "video") && <NumField label="Width (px)" value={b.width} max={800} onChange={(v) => set({ width: v })} />}
          {t !== "columns" && t !== "image" && t !== "details" && align}
          {(t === "header" || t === "badge" || t === "code" || t === "callout") && <ColorField label="Background" value={b.backgroundColor} onChange={(v) => set({ backgroundColor: v })} />}
          {(t === "quote" || t === "callout" || t === "card" || t === "details" || t === "social" || t === "code") && <ColorField label={t === "quote" ? "Accent line" : "Border"} value={b.borderColor} onChange={(v) => set({ borderColor: v })} />}
          {t !== "header" && t !== "button" && t !== "buttons" && t !== "image" && t !== "columns" && textColor}
          {(t === "button" || t === "buttons" || t === "card") && buttonColors}
        </Group>
      )}

      <Group label="Spacing">
        <div className={cn("grid gap-2", t === "spacer" ? "grid-cols-1" : "grid-cols-3")}>
          {t !== "spacer" && <NumField label="Top" value={b.padTop} onChange={(v) => set({ padTop: v })} />}
          <NumField label="Bottom" value={b.padBottom} onChange={(v) => set({ padBottom: v })} />
          {t !== "spacer" && <NumField label="Sides" value={b.padX} onChange={(v) => set({ padX: v })} />}
        </div>
      </Group>
    </div>
  );
}

const FONTS = [
  { value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", label: "System (modern)" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "'Trebuchet MS', Helvetica, sans-serif", label: "Trebuchet" },
] as const;

// The whole email's look, when no block is selected.
export function StyleInspector({ s, set }: { s: EmailSettings; set: (patch: Partial<EmailSettings>) => void }) {
  const font = FONTS.find((f) => f.value === s.fontFamily)?.value ?? FONTS[0].value;
  return (
    <div className="space-y-4">
      <Group label="Email">
        <F label="Font"><Pick label="Font" value={font} onChange={(fontFamily) => set({ fontFamily })} options={FONTS} /></F>
        <NumField label="Width (px)" value={s.width} max={800} onChange={(width) => set({ width })} />
      </Group>
      <Group label="Colors">
        <ColorField label="Page background" value={s.backgroundColor} onChange={(backgroundColor) => set({ backgroundColor })} />
        <ColorField label="Card background" value={s.contentColor} onChange={(contentColor) => set({ contentColor })} />
        <ColorField label="Text color" value={s.textColor} onChange={(textColor) => set({ textColor })} />
      </Group>
      <p className="text-xs text-muted-foreground">Click a block in the email to edit it.</p>
    </div>
  );
}
