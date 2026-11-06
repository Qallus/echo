"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDown, ArrowLeft, ArrowUp, Code, Columns2, Copy, FlaskConical, GripVertical, Heading, Image as ImageIcon, LayoutTemplate,
  Minus, MousePointerClick, MoveVertical, PanelBottom, PanelTop, Trash2, Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTemplate, sendTestEmail } from "@/lib/admin/actions/comms";
import {
  BLOCKS, BLOCK_ORDER, CATEGORIES, MERGE_FIELDS, STATUSES, applyMerge, blockId, createBlock, defaultSchema, htmlTemplate, schemaToEditableHtml, schemaToHtml,
  type BlockType, type EmailBlock, type EmailSchema, type TemplateMode, type TemplateStatus,
} from "@/lib/comms/blocks";
import type { Template } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { BlockInspector, F, StyleInspector } from "./block-inspector";
import { EmailPreview } from "./email-preview";
import { Pick, optionsOf } from "./pick";
import { SAMPLE } from "./send-panel";

const HtmlEditor = dynamic(() => import("./html-editor").then((m) => m.HtmlEditor), { ssr: false, loading: () => <div className="h-[680px] rounded-xl border" /> });

const ICONS: Record<BlockType, typeof Type> = {
  header: PanelTop, heading: Heading, text: Type, button: MousePointerClick, image: ImageIcon, columns: Columns2, divider: Minus, spacer: MoveVertical, footer: PanelBottom,
};
const summary = (b: EmailBlock) => (b.type === "columns" ? (b.columns ?? []).map((c) => c.blocks[0]?.text ?? "").join(" | ") : b.text || b.title || b.url || "");

// Build a template from blocks or write it as HTML, with a live preview at
// desktop and phone width. Saves are checked against the revision it opened
// at, so nobody's changes are silently overwritten.
export function EmailEditor({ template, onDone }: { template?: Template; onDone: () => void }) {
  const [id, setId] = useState(template?.id ?? null);
  const [revision, setRevision] = useState<number | null>(template?.revision ?? null);
  const [name, setName] = useState(template?.name ?? "Untitled template");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [preheader, setPreheader] = useState(template?.preheader ?? "");
  const [category, setCategory] = useState(template?.category ?? "general");
  const [status, setStatus] = useState<TemplateStatus>(template?.status ?? "draft");
  const [mode, setMode] = useState<TemplateMode>(template?.mode ?? "blocks");
  const [schema, setSchema] = useState<EmailSchema>(template?.schema ?? defaultSchema());
  const [html, setHtml] = useState(template?.mode === "html" ? template.html : "");
  const [selected, setSelected] = useState<string | null>(schema.blocks[1]?.id ?? null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dirty, setDirty] = useState(!template);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const edit = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true); };

  const blocks = schema.blocks;
  const setBlocks = (next: EmailBlock[]) => { setSchema({ ...schema, blocks: next }); setDirty(true); };
  const sel = blocks.find((b) => b.id === selected) ?? null;
  const update = (bid: string, patch: Partial<EmailBlock>) => setBlocks(blocks.map((b) => (b.id === bid ? { ...b, ...patch } : b)));
  const move = (from: number, to: number) => { if (to < 0 || to >= blocks.length) return; const next = [...blocks]; const [x] = next.splice(from, 1); next.splice(to, 0, x); setBlocks(next); };
  const add = (type: BlockType) => {
    const b = createBlock(type);
    const at = sel ? blocks.findIndex((x) => x.id === sel.id) + 1 : blocks.length;
    setBlocks([...blocks.slice(0, at), b, ...blocks.slice(at)]);
    setSelected(b.id);
  };

  const preview = useMemo(() => applyMerge(mode === "html" ? htmlTemplate(html, { preheader }) : schemaToHtml(schema, { preheader }), SAMPLE, true), [mode, html, schema, preheader]);

  const switchMode = (next: TemplateMode) => {
    if (next === mode) return;
    if (next === "html") {
      if (!html.trim() || confirm("Start the HTML from your current blocks? This replaces the HTML you wrote before.")) setHtml(schemaToEditableHtml(schema));
    } else if (!confirm("Switch back to blocks? The email will use the blocks again, and your HTML edits are replaced when you save.")) return;
    setMode(next); setDirty(true);
  };

  const save = async () => {
    const res = await saveTemplate(id, { name, subject, preheader, category, status, mode, schema, html: mode === "html" ? html : null, revision });
    setMsg(res);
    if (res.error) return null;
    setId(res.id ?? id); setRevision(res.revision ?? null); setDirty(false);
    return res.id ?? id;
  };
  const test = () => start(async () => {
    const saved = dirty || !id ? await save() : id;
    if (saved) setMsg(await sendTestEmail({ templateId: saved }, null));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => (!dirty || confirm("Leave without saving your changes?")) && onDone()}><ArrowLeft /> Templates</Button>
        <div className="flex gap-1 rounded-lg border p-0.5" role="group" aria-label="Editor">
          <button type="button" aria-pressed={mode === "blocks"} onClick={() => switchMode("blocks")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-sm", mode === "blocks" ? "bg-accent font-medium" : "text-muted-foreground")}><LayoutTemplate className="size-3.5" /> Blocks</button>
          <button type="button" aria-pressed={mode === "html"} onClick={() => switchMode("html")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-sm", mode === "html" ? "bg-accent font-medium" : "text-muted-foreground")}><Code className="size-3.5" /> HTML</button>
        </div>
        <span className="ml-auto text-sm text-muted-foreground" role="status">{msg.error ?? msg.ok ?? (dirty ? "Unsaved changes" : "")}</span>
        <Button variant="outline" disabled={pending} onClick={test} title="Saves, then sends a copy to your own email"><FlaskConical /> {dirty || !id ? "Save & send test" : "Send test to me"}</Button>
        <Button disabled={pending} onClick={() => start(async () => { await save(); })}>{pending ? "Saving…" : "Save template"}</Button>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.5fr_1.5fr_0.8fr_0.8fr]">
        <F label="Template name"><Input value={name} onChange={(e) => edit(setName)(e.target.value)} className="h-8" /></F>
        <F label="Subject"><Input value={subject} onChange={(e) => edit(setSubject)(e.target.value)} className="h-8" placeholder="Hi {{first_name}}, …" /></F>
        <F label="Preview text"><Input value={preheader} onChange={(e) => edit(setPreheader)(e.target.value)} className="h-8" placeholder="Shown after the subject in the inbox" /></F>
        <F label="Category"><Pick label="Category" value={CATEGORIES.includes(category) ? category : "general"} onChange={edit(setCategory)} options={optionsOf(CATEGORIES)} /></F>
        <F label="Status"><Pick label="Status" value={status} onChange={edit(setStatus)} options={optionsOf(STATUSES)} /></F>
      </div>
      {status !== "active" && <p className="text-xs text-muted-foreground">{status === "draft" ? "Drafts can be tested but not sent, and automations skip them. Set it to Active when it's ready." : "Archived templates are hidden from the Send picker and automations skip them."}</p>}

      {mode === "html" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <HtmlEditor value={html} onChange={edit(setHtml)} />
          <EmailPreview html={preview} note="example contact" height={680} />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[200px_minmax(0,1fr)_300px]">
          <section className="space-y-3">
            <div className="space-y-1.5 rounded-xl border bg-card p-2">
              <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Add a block</h3>
              {BLOCK_ORDER.map((t) => {
                const Icon = ICONS[t];
                return (
                  <button key={t} type="button" onClick={() => add(t)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0"><span className="block text-sm font-medium">{BLOCKS[t].label}</span><span className="block truncate text-[11px] text-muted-foreground">{BLOCKS[t].hint}</span></span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-1 rounded-xl border bg-card p-2 text-xs">
              <h3 className="px-1 font-semibold tracking-wide text-muted-foreground uppercase">Merge fields</h3>
              <p className="px-1 text-muted-foreground">Filled in for each person. Click to copy.</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {MERGE_FIELDS.map((m) => <button key={m.token} type="button" title={m.token} onClick={() => navigator.clipboard?.writeText(m.token)} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">{m.label}</button>)}
              </div>
            </div>
          </section>

          <section className="min-w-0 space-y-3">
            <ol className="space-y-1 rounded-xl border bg-card p-2" aria-label="Blocks">
              {blocks.map((b, i) => {
                const Icon = ICONS[b.type];
                return (
                  <li key={b.id} draggable onDragStart={() => setDragging(i)} onDragEnd={() => setDragging(null)}
                    onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragging !== null) move(dragging, i); setDragging(null); }}
                    className={cn("group flex items-center gap-2 rounded-lg border px-2 py-1.5", selected === b.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/40", dragging === i && "opacity-50")}>
                    <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                    <button type="button" onClick={() => setSelected(b.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="shrink-0 text-xs font-semibold">{BLOCKS[b.type].label}</span>
                      <span className="truncate text-xs text-muted-foreground">{summary(b)}</span>
                    </button>
                    <div className="flex shrink-0 gap-0.5 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp /></Button>
                      <Button size="icon-xs" variant="ghost" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)}><ArrowDown /></Button>
                      <Button size="icon-xs" variant="ghost" aria-label="Duplicate" onClick={() => { const c = { ...structuredClone(b), id: blockId() }; setBlocks([...blocks.slice(0, i + 1), c, ...blocks.slice(i + 1)]); }}><Copy /></Button>
                      <Button size="icon-xs" variant="ghost" aria-label="Delete" onClick={() => { setBlocks(blocks.filter((x) => x.id !== b.id)); if (selected === b.id) setSelected(null); }}><Trash2 /></Button>
                    </div>
                  </li>
                );
              })}
              {blocks.length === 0 && <li className="p-2 text-sm text-muted-foreground">Add a block from the left to start.</li>}
            </ol>
            <EmailPreview html={preview} note="example contact" />
          </section>

          <section className="min-w-0 self-start rounded-xl border bg-card p-3 xl:sticky xl:top-4">
            {sel ? <BlockInspector b={sel} set={(patch) => update(sel.id, patch)} />
              : <StyleInspector s={schema.settings} set={(patch) => { setSchema({ ...schema, settings: { ...schema.settings, ...patch } }); setDirty(true); }} />}
            {sel && <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSelected(null)}>Email style</Button>}
          </section>
        </div>
      )}
    </div>
  );
}
