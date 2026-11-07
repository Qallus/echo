"use client";

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, Code, Copy, Eye, FlaskConical, LayoutTemplate, Monitor, PanelRightClose, PanelRightOpen, SlidersHorizontal, Smartphone, Trash2 } from "lucide-react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { saveTemplate, sendTestEmail } from "@/lib/admin/actions/comms";
import {
  BLOCKS, CATEGORIES, STATUSES, applyMerge, blockId, createBlock, defaultSchema, htmlTemplate, schemaToEditableHtml, schemaToHtml,
  type BlockType, type EmailBlock, type EmailSchema, type TemplateMode, type TemplateStatus,
} from "@/lib/comms/blocks";
import type { Template } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { BlockInspector, StyleInspector } from "./block-inspector";
import { BlockPalette } from "./block-palette";
import { EmailCanvas } from "./email-canvas";
import { EmailPreview } from "./email-preview";
import type { HtmlEditorHandle } from "./html-editor";
import { MergeFieldsBar } from "./merge-fields-bar";
import { Pick, optionsOf } from "./pick";
import { SAMPLE } from "./send-panel";

const HtmlEditor = dynamic(() => import("./html-editor").then((m) => m.HtmlEditor), { ssr: false, loading: () => <div className="m-3 h-[480px] rounded-xl border" /> });

// Blocks per row in the palette, remembered in this browser (kept in memory
// too, in case storage is blocked).
const COLS_KEY = "echo.email.paletteCols";
const colsListeners = new Set<() => void>();
let colsMemory: 1 | 2 | null = null;
const readCols = (): 1 | 2 => { if (colsMemory) return colsMemory; try { return localStorage.getItem(COLS_KEY) === "2" ? 2 : 1; } catch { return 1; } };
const onColsChange = (fn: () => void) => { colsListeners.add(fn); return () => { colsListeners.delete(fn); }; };
const saveCols = (c: 1 | 2) => { colsMemory = c; try { localStorage.setItem(COLS_KEY, String(c)); } catch {} colsListeners.forEach((fn) => fn()); };
const TEXT_BLOCKS: BlockType[] = ["heading", "text", "button", "footer", "callout", "quote", "badge", "card", "signature"];

// Ctrl-P style template editor: name, subject and status on top, then a
// fixed-height workspace: the block palette on the left, the fields row and
// canvas in the middle (it scrolls on its own), and the selected block's
// settings on the right. Both side columns can be dragged wider or collapsed. Click a block in the email to edit it, drag
// it to move it, or drop new blocks between blocks. Saves are checked against
// the revision it opened at, so nobody's changes are silently overwritten.
export function EmailEditor({ template, onDone }: { template?: Template; onDone: () => void }) {
  const [id, setId] = useState(template?.id ?? null);
  const [revision, setRevision] = useState<number | null>(template?.revision ?? null);
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [preheader, setPreheader] = useState(template?.preheader ?? "");
  const [category, setCategory] = useState(template?.category ?? "general");
  const [status, setStatus] = useState<TemplateStatus>(template?.status ?? "draft");
  const [mode, setMode] = useState<TemplateMode>(template?.mode ?? "blocks");
  const [schema, setSchema] = useState<EmailSchema>(template?.schema ?? defaultSchema());
  const [html, setHtml] = useState(template?.mode === "html" ? template.html : "");
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(!template);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const lastField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const htmlEditor = useRef<HtmlEditorHandle>(null);
  const isMobile = useIsMobile();
  const leftRef = useRef<PanelImperativeHandle>(null);
  const rightRef = useRef<PanelImperativeHandle>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const paletteCols = useSyncExternalStore(onColsChange, readCols, () => 1 as const);
  const edit = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true); };

  const blocks = schema.blocks;
  const setBlocks = (next: EmailBlock[]) => { setSchema((s) => ({ ...s, blocks: next })); setDirty(true); };
  const sel = blocks.find((b) => b.id === selected) ?? null;
  const update = (bid: string, patch: Partial<EmailBlock>) => setBlocks(blocks.map((b) => (b.id === bid ? { ...b, ...patch } : b)));
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= blocks.length) return;
    const next = [...blocks]; const [x] = next.splice(from, 1); next.splice(to, 0, x); setBlocks(next);
  };
  const insert = (type: BlockType, at: number) => {
    const b = createBlock(type);
    setBlocks([...blocks.slice(0, at), b, ...blocks.slice(at)]);
    setSelected(b.id);
  };
  // Clicking a palette item adds the block under the selected one (or at the end).
  const add = (type: BlockType) => insert(type, sel ? blocks.findIndex((x) => x.id === sel.id) + 1 : blocks.length);
  const duplicate = (i: number) => { const c = { ...structuredClone(blocks[i]), id: blockId() }; setBlocks([...blocks.slice(0, i + 1), c, ...blocks.slice(i + 1)]); setSelected(c.id); };
  // Clicking a block opens its settings (expanding that column if it's collapsed).
  const selectBlock = (bid: string | null) => { setSelected(bid); lastField.current = null; if (bid && rightRef.current?.isCollapsed()) rightRef.current.expand(); };
  const remove = (bid: string) => { setBlocks(blocks.filter((x) => x.id !== bid)); if (selected === bid) setSelected(null); };

  // A merge field goes where the cursor was (subject, preview text or any
  // text box on the right), else onto the end of the selected block's text,
  // else it's copied.
  const insertField = (token: string) => {
    if (mode === "html") { htmlEditor.current?.insert(token); return; }
    const el = lastField.current;
    if (el?.isConnected) {
      el.focus();
      if (document.execCommand("insertText", false, token)) return;
    }
    if (sel && TEXT_BLOCKS.includes(sel.type)) { update(sel.id, { text: `${sel.text ?? ""}${token}` }); setMsg({ ok: `Added ${token} to the ${BLOCKS[sel.type].label.toLowerCase()}` }); return; }
    void navigator.clipboard?.writeText(token);
    setMsg({ ok: `Copied ${token}` });
  };
  const trackField = (e: React.FocusEvent) => {
    const t = e.target;
    if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type === "text")) lastField.current = t;
  };

  const preview = useMemo(() => applyMerge(mode === "html" ? htmlTemplate(html, { preheader }) : schemaToHtml(schema, { preheader }), SAMPLE, true), [mode, html, schema, preheader]);

  const switchMode = (next: TemplateMode) => {
    if (next === mode) return;
    if (next === "html") {
      if (!html.trim() || confirm("Start the HTML from your current blocks? This replaces the HTML you wrote before.")) setHtml(schemaToEditableHtml(schema));
    } else if (!confirm("Switch back to the visual editor? The email will use the blocks again, and your HTML edits are replaced when you save.")) return;
    setMode(next); setDirty(true); lastField.current = null;
  };

  const save = async () => {
    const res = await saveTemplate(id, { name: name.trim() || "Untitled template", subject, preheader, category, status, mode, schema, html: mode === "html" ? html : null, revision });
    setMsg(res);
    if (res.error) return null;
    setId(res.id ?? id); setRevision(res.revision ?? null); setDirty(false);
    return res.id ?? id;
  };
  const test = () => start(async () => {
    const saved = dirty || !id ? await save() : id;
    if (saved) setMsg(await sendTestEmail({ templateId: saved }, null));
  });
  const toggle = (on: boolean) => cn("flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium", on ? "bg-primary text-primary-foreground" : "border bg-background text-muted-foreground hover:text-foreground");

  const fieldsBar = (
    <MergeFieldsBar onInsert={insertField}>
      <div className="flex shrink-0 rounded-lg border p-0.5">
        <Button size="icon-xs" variant={device === "desktop" ? "secondary" : "ghost"} aria-label="Desktop width" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor /></Button>
        <Button size="icon-xs" variant={device === "phone" ? "secondary" : "ghost"} aria-label="Phone width" aria-pressed={device === "phone"} onClick={() => setDevice("phone")}><Smartphone /></Button>
      </div>
    </MergeFieldsBar>
  );
  const canvas = (
    <EmailCanvas schema={schema} sample={SAMPLE} device={device} selected={selected} onSelect={selectBlock}
      onMove={move} onInsert={insert} onDuplicate={duplicate} onDelete={remove} />
  );
  const settings = <>
    <div className="mb-3 flex items-center gap-1">
      <h3 className="flex-1 text-sm font-semibold">{sel ? `${BLOCKS[sel.type].label} settings` : "Email style"}</h3>
      {sel && <>
        <Button size="icon-xs" variant="ghost" aria-label="Duplicate block" onClick={() => duplicate(blocks.indexOf(sel))}><Copy /></Button>
        <Button size="icon-xs" variant="ghost" className="text-destructive" aria-label="Delete block" onClick={() => remove(sel.id)}><Trash2 /></Button>
      </>}
      {!isMobile && <Button size="icon-xs" variant="ghost" aria-label="Collapse settings" title="Collapse" onClick={() => rightRef.current?.collapse()}><PanelRightClose /></Button>}
    </div>
    {sel ? <BlockInspector key={sel.id} b={sel} set={(patch) => update(sel.id, patch)} />
      : <StyleInspector s={schema.settings} set={(patch) => { setSchema((s) => ({ ...s, settings: { ...s.settings, ...patch } })); setDirty(true); }} />}
    {sel && <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setSelected(null)}>Done: back to email style</Button>}
  </>;

  return (
    <div className="rounded-xl border bg-card" onFocusCapture={trackField}>
      <div className="space-y-2 border-b p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="Back to templates" onClick={() => (!dirty || confirm("Leave without saving your changes?")) && onDone()}><ArrowLeft /></Button>
          <Input value={name} onChange={(e) => edit(setName)(e.target.value)} placeholder="Template name" aria-label="Template name" className="h-8 min-w-48 flex-1" />
          <Input value={subject} onChange={(e) => edit(setSubject)(e.target.value)} placeholder="Subject line" aria-label="Subject" className="h-8 min-w-48 flex-[1.4]" />
          <Pick label="Status" value={status} onChange={edit(setStatus)} options={optionsOf(STATUSES)} className="w-28" />
          <Button size="sm" disabled={pending} onClick={() => start(async () => { await save(); })}><Check /> {pending ? "Saving…" : "Save"}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={preheader} onChange={(e) => edit(setPreheader)(e.target.value)} placeholder="Short preview shown in inbox…" aria-label="Preview text" className="h-8 min-w-48 flex-1 text-xs" />
          <Pick label="Category" value={CATEGORIES.includes(category) ? category : "general"} onChange={edit(setCategory)} options={optionsOf(CATEGORIES)} className="w-32" />
          <div className="flex gap-1" role="group" aria-label="Editor">
            <button type="button" aria-pressed={mode === "blocks"} onClick={() => switchMode("blocks")} className={toggle(mode === "blocks")}><LayoutTemplate className="size-3.5" /> Visual</button>
            <button type="button" aria-pressed={mode === "html"} onClick={() => switchMode("html")} className={toggle(mode === "html")}><Code className="size-3.5" /> HTML</button>
          </div>
          <Button size="icon-sm" variant="outline" aria-label="Preview the email" title="Preview" onClick={() => setPreviewing(true)}><Eye /></Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={test} title="Saves, then sends a copy to your own email"><FlaskConical /> {dirty || !id ? "Save & test" : "Send test"}</Button>
        </div>
        <p className="min-h-4 text-xs text-muted-foreground" role="status">
          {msg.error ? <span className="text-destructive">{msg.error}</span> : msg.ok ?? (dirty ? "Unsaved changes" : "")}
          {status !== "active" && <span className="ml-2">{status === "draft" ? "Draft: can be tested, not sent; automations skip it." : "Archived: hidden from Send, automations skip it."}</span>}
        </p>
      </div>

      {mode === "html" ? (
        <div>
          <div className="sticky top-0 z-20"><MergeFieldsBar onInsert={insertField} /></div>
          <HtmlEditor value={html} onChange={edit(setHtml)} handle={htmlEditor} />
        </div>
      ) : (
        isMobile ? (
          <div>
            <BlockPalette cols={2} setCols={() => {}} collapsed={false} onToggle={() => {}} onAdd={add} />
            <div className="border-y bg-muted/40">{fieldsBar}{canvas}</div>
            <div className="p-3">{settings}</div>
          </div>
        ) : (
          <ResizablePanelGroup className="h-[calc(100dvh-6rem)] min-h-[560px] rounded-b-xl">
            <ResizablePanel panelRef={leftRef} defaultSize={232} minSize={170} maxSize={460} collapsible collapsedSize={48}
              onResize={(size) => setLeftCollapsed(size.inPixels < 100)} className="overflow-y-auto">
              <BlockPalette cols={paletteCols} setCols={saveCols} collapsed={leftCollapsed} onAdd={add}
                onToggle={() => (leftRef.current?.isCollapsed() ? leftRef.current.expand() : leftRef.current?.collapse())} />
            </ResizablePanel>
            <ResizableHandle withHandle className="w-1.5 bg-border transition-colors hover:bg-primary/40 data-[separator=active]:bg-primary/60" />
            <ResizablePanel minSize={360} className="overflow-y-auto bg-muted/40">
              <div className="sticky top-0 z-20">{fieldsBar}</div>
              {canvas}
            </ResizablePanel>
            <ResizableHandle withHandle className="w-1.5 bg-border transition-colors hover:bg-primary/40 data-[separator=active]:bg-primary/60" />
            <ResizablePanel panelRef={rightRef} defaultSize={300} minSize={240} maxSize={560} collapsible collapsedSize={48}
              onResize={(size) => setRightCollapsed(size.inPixels < 120)} className="overflow-y-auto">
              {rightCollapsed ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Button size="icon-sm" variant="ghost" aria-label="Expand settings" title="Expand settings" onClick={() => rightRef.current?.expand()}><PanelRightOpen /></Button>
                  <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
                </div>
              ) : <div className="p-3">{settings}</div>}
            </ResizablePanel>
          </ResizablePanelGroup>
        )
      )}

      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent title={subject ? applyMerge(subject, SAMPLE) : "Preview"} description="How it arrives, filled in for an example contact." className="max-w-4xl">
          <EmailPreview html={preview} note="example contact" height={640} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
