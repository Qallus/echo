"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Monitor, Plus, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveTemplate } from "@/lib/admin/actions/comms";
import { BLOCKS, BLOCK_ORDER, MERGE_FIELDS, applyMerge, blockId, createBlock, defaultSchema, schemaToHtml, type EmailBlock, type EmailSchema } from "@/lib/comms/blocks";
import { cn } from "@/lib/utils";

const SAMPLE = { first_name: "Dana", last_name: "Whitfield", full_name: "Dana Whitfield", email: "dana@example.com", company: "Oasis Resorts", title: "VP Operations", owner: "Jeremy", deal: "Oasis: Business plan", stage: "Proposal", amount: "$4,800", site_url: "https://echo.redial.si", unsubscribe_url: "#" };
const CATEGORIES = ["general", "sales", "onboarding", "follow-up", "newsletter", "billing", "support"];
const SELECT = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30";

function F({ label, children }: { label: string; children: React.ReactNode }) {
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

// The block inspector: the fields for whichever block is selected.
function Inspector({ b, set }: { b: EmailBlock; set: (patch: Partial<EmailBlock>) => void }) {
  const insert = (token: string) => set({ text: `${b.text ?? ""}${token}` });
  const alignField = (
    <F label="Align">
      <select value={b.align ?? "left"} onChange={(e) => set({ align: e.target.value as EmailBlock["align"] })} className={SELECT}>
        <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
      </select>
    </F>
  );
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
        {b.type !== "footer" && (
          <div className="flex flex-wrap gap-1">
            {MERGE_FIELDS.slice(0, 8).map((m) => <button key={m.token} type="button" onClick={() => insert(m.token)} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">{m.label}</button>)}
          </div>
        )}
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
        <F label="Alt text"><Input value={b.alt ?? ""} onChange={(e) => set({ alt: e.target.value })} className="h-8" /></F>
        <F label="Link (optional)"><Input value={b.linkUrl ?? ""} onChange={(e) => set({ linkUrl: e.target.value })} className="h-8" /></F>
        <div className="grid grid-cols-2 gap-2"><NumField label="Width" value={b.width} max={800} onChange={(v) => set({ width: v })} />{alignField}</div>
      </>}
      {b.type === "divider" && <ColorField label="Line color" value={b.dividerColor} onChange={(v) => set({ dividerColor: v })} />}
      {b.type === "spacer" && <NumField label="Height" value={b.height} max={300} onChange={(v) => set({ height: v })} />}
      {b.type === "columns" && (b.columns ?? []).map((c, i) => (
        <F key={i} label={`Column ${i + 1}`}>
          <Textarea rows={4} value={c.blocks[0]?.text ?? ""}
            onChange={(e) => set({ columns: (b.columns ?? []).map((col, k) => (k === i ? { blocks: [{ ...(col.blocks[0] ?? createBlock("text")), text: e.target.value }] } : col)) })} />
        </F>
      ))}
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

const preview = (b: EmailBlock) => (b.type === "columns" ? (b.columns ?? []).map((c) => c.blocks[0]?.text ?? "").join(" | ") : b.text || b.title || b.url || "");

// Build an email from blocks, with a live desktop/phone preview. Saves to email_templates.
export function EmailEditor({ template, onDone }: {
  template?: { id: string; name: string; subject: string; preheader: string | null; category: string; schema: EmailSchema | null }; onDone: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "Untitled template");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [preheader, setPreheader] = useState(template?.preheader ?? "");
  const [category, setCategory] = useState(template?.category ?? "general");
  const [schema, setSchema] = useState<EmailSchema>(template?.schema ?? defaultSchema());
  const [selected, setSelected] = useState<string | null>(schema.blocks[1]?.id ?? null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const blocks = schema.blocks;
  const setBlocks = (next: EmailBlock[]) => setSchema({ ...schema, blocks: next });
  const sel = blocks.find((b) => b.id === selected) ?? null;
  const update = (id: string, patch: Partial<EmailBlock>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (i: number, d: number) => { const next = [...blocks]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); setBlocks(next); };
  const add = (type: EmailBlock["type"]) => {
    const b = createBlock(type);
    const at = sel ? blocks.findIndex((x) => x.id === sel.id) + 1 : blocks.length;
    setBlocks([...blocks.slice(0, at), b, ...blocks.slice(at)]);
    setSelected(b.id);
  };
  const html = useMemo(() => applyMerge(schemaToHtml(schema, { preheader }), SAMPLE, true), [schema, preheader]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}><ArrowLeft /> Templates</Button>
        <span className="ml-auto text-sm text-muted-foreground">{msg.error ?? msg.ok}</span>
        <Button disabled={pending} onClick={() => start(async () => {
          const res = await saveTemplate(template?.id ?? null, { name, subject, preheader, category, schema });
          setMsg(res);
          if (!res.error && !template) onDone();
        })}>{pending ? "Saving…" : "Save template"}</Button>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <F label="Template name"><Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" /></F>
        <F label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8" placeholder="Hi {{first_name}}, …" /></F>
        <F label="Preview text"><Input value={preheader} onChange={(e) => setPreheader(e.target.value)} className="h-8" placeholder="Shown after the subject in the inbox" /></F>
        <F label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>{CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select>
        </F>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,300px)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-2 rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Blocks</h3>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}><Plus /> Add</DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {BLOCK_ORDER.map((t) => <DropdownMenuItem key={t} onClick={() => add(t)}><span className="font-medium">{BLOCKS[t].label}</span><span className="ml-auto text-xs text-muted-foreground">{BLOCKS[t].hint}</span></DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ol className="space-y-1.5">
            {blocks.map((b, i) => (
              <li key={b.id} className={cn("group rounded-lg border p-2", selected === b.id ? "border-primary bg-primary/5" : "hover:bg-muted/40")}>
                <button type="button" onClick={() => setSelected(b.id)} className="block w-full text-left">
                  <span className="text-xs font-semibold">{BLOCKS[b.type].label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{preview(b) || " "}</span>
                </button>
                <div className="mt-1 flex justify-end gap-0.5 sm:opacity-0 sm:group-hover:opacity-100">
                  <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Duplicate" onClick={() => { const c = { ...structuredClone(b), id: blockId() }; setBlocks([...blocks.slice(0, i + 1), c, ...blocks.slice(i + 1)]); }}><Copy /></Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Delete" onClick={() => { setBlocks(blocks.filter((x) => x.id !== b.id)); if (selected === b.id) setSelected(null); }}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ol>
          {blocks.length === 0 && <p className="text-sm text-muted-foreground">Add a block to start.</p>}
        </section>

        <section className="min-w-0 rounded-xl border bg-card p-3">
          {sel ? <Inspector b={sel} set={(patch) => update(sel.id, patch)} /> : (
            <div className="space-y-3">
              <p className="text-sm font-medium">Email style</p>
              <ColorField label="Page background" value={schema.settings.backgroundColor} onChange={(v) => setSchema({ ...schema, settings: { ...schema.settings, backgroundColor: v } })} />
              <ColorField label="Card background" value={schema.settings.contentColor} onChange={(v) => setSchema({ ...schema, settings: { ...schema.settings, contentColor: v } })} />
              <ColorField label="Text color" value={schema.settings.textColor} onChange={(v) => setSchema({ ...schema, settings: { ...schema.settings, textColor: v } })} />
              <p className="text-xs text-muted-foreground">Select a block to edit it.</p>
            </div>
          )}
          {sel && <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSelected(null)}>Email style</Button>}
        </section>

        <section className="min-w-0 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preview (sample contact)</h3>
            <div className="flex rounded-lg border p-0.5">
              <Button size="icon-sm" variant={device === "desktop" ? "secondary" : "ghost"} aria-label="Desktop preview" onClick={() => setDevice("desktop")}><Monitor /></Button>
              <Button size="icon-sm" variant={device === "phone" ? "secondary" : "ghost"} aria-label="Phone preview" onClick={() => setDevice("phone")}><Smartphone /></Button>
            </div>
          </div>
          <div className="flex justify-center rounded-xl border bg-muted/30 p-2">
            <iframe title="Email preview" sandbox="" srcDoc={`<!doctype html><html><body style="margin:0">${html}</body></html>`}
              className={cn("h-[640px] rounded-lg bg-white", device === "phone" ? "w-[380px]" : "w-full")} />
          </div>
        </section>
      </div>
    </div>
  );
}
