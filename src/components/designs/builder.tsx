"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ImageUp, Link2, Loader2, Save, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { saveDesign } from "@/lib/designs/actions";
import { BLOCKS, MERGE_FIELDS, normalizeDesign, type MergeValues, type SummaryDesign } from "@/lib/designs/schema";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SummaryDocument, type SummaryData } from "./summary-document";

const STEPS = [
  { id: "logo", title: "Logo", hint: "Upload or link your logo" },
  { id: "header", title: "Header", hint: "Title, subtitle and colors" },
  { id: "background", title: "Background", hint: "Page, paper, text and accent" },
  { id: "footerBg", title: "Footer background", hint: "Footer colors" },
  { id: "footer", title: "Footer content", hint: "Company details and links" },
  { id: "blocks", title: "Blocks", hint: "What appears, in what order" },
  { id: "save", title: "Save", hint: "Name it and choose who can use it" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

// Clicking a part of the canvas jumps to the step that edits it.
const PART_STEP: Record<string, StepId> = { logo: "logo", header: "header", body: "blocks", footer: "footer" };

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => { onChange(e.target.value); setDraft(e.target.value); }}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5" aria-label={`${label} picker`} />
        <Input value={draft} onChange={(e) => { setDraft(e.target.value); if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(e.target.value)) onChange(e.target.value); }}
          className="font-mono" maxLength={7} aria-label={`${label} hex`} />
      </div>
    </div>
  );
}

function MergeChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {MERGE_FIELDS.map((f) => (
        <button key={f.token} type="button" onClick={() => onInsert(f.token)} className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function DesignBuilder({ id, initialName, initial, userId, workspaces, initialWorkspaceId, initialDefault, preview, values }: {
  id: string | null; initialName: string; initial: SummaryDesign; userId: string; workspaces: Workspace[];
  initialWorkspaceId: string | null; initialDefault: boolean; preview: SummaryData; values: MergeValues;
}) {
  const router = useRouter();
  const [design, setDesign] = useState(initial);
  const [step, setStep] = useState<StepId>("logo");
  const [visited, setVisited] = useState<Set<StepId>>(new Set(["logo"]));
  const [name, setName] = useState(initialName);
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId ?? "");
  const [makeDefault, setMakeDefault] = useState(initialDefault);
  const [logoMode, setLogoMode] = useState<"upload" | "url">(initial.logo.url && !initial.logo.url.includes("/branding/") ? "url" : "upload");
  const [urlDraft, setUrlDraft] = useState(initial.logo.url ?? "");
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const index = STEPS.findIndex((s) => s.id === step);
  const go = (s: StepId) => { setStep(s); setVisited((v) => new Set(v).add(s)); };
  const set = <K extends keyof SummaryDesign>(key: K, patch: Partial<SummaryDesign[K]>) =>
    setDesign((d) => normalizeDesign({ ...d, [key]: { ...(d[key] as object), ...patch } }, d));

  const upload = (file: File) => start(async () => {
    setMessage(undefined);
    if (!file.type.startsWith("image/")) return setMessage({ text: "Choose an image (PNG, JPG, WebP or SVG).", error: true });
    if (file.size > 2 * 1024 * 1024) return setMessage({ text: "Logos can be up to 2 MB.", error: true });
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${userId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { contentType: file.type });
    if (error) return setMessage({ text: error.message, error: true });
    set("logo", { url: supabase.storage.from("branding").getPublicUrl(path).data.publicUrl });
  });

  const save = () => start(async () => {
    setMessage(undefined);
    const res = await saveDesign(id, name, design, { workspaceId: workspaceId || null, makeDefault });
    if (res.error) return setMessage({ text: res.error, error: true });
    setMessage({ text: "Design saved." });
    if (!id && res.id) router.replace(`/templates/designs/${res.id}`);
    else router.refresh();
  });

  const blockMove = (i: number, dir: -1 | 1) => setDesign((d) => {
    const blocks = d.blocks.slice();
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return d;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    return { ...d, blocks };
  });

  const settings: Record<StepId, React.ReactNode> = {
    logo: (
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border p-0.5 text-sm">
          {(["upload", "url"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setLogoMode(m)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1", logoMode === m ? "bg-muted font-medium" : "text-muted-foreground")}>
              {m === "upload" ? <><ImageUp className="size-3.5" /> Upload</> : <><Link2 className="size-3.5" /> Image URL</>}
            </button>
          ))}
        </div>
        {logoMode === "upload" ? (
          <button type="button" onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
            {pending ? <Loader2 className="size-5 animate-spin" /> : <ImageUp className="size-5" />}
            <span><span className="font-medium text-foreground">Click to upload</span> or drag a file here</span>
            <span className="text-xs">PNG, JPG, WebP or SVG · up to 2 MB · transparent PNG works best</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="logo-url">Logo URL</Label>
            <div className="flex gap-2">
              <Input id="logo-url" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="https://example.com/logo.png" />
              <Button type="button" variant="outline" onClick={() => set("logo", { url: urlDraft })}>Use</Button>
            </div>
          </div>
        )}
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        {design.logo.url && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="logo-h">Height · {design.logo.height}px</Label>
              <input id="logo-h" type="range" min={16} max={120} value={design.logo.height} onChange={(e) => set("logo", { height: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label>Alignment</Label>
              <div className="flex gap-1">
                {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => (
                  <Button key={a} type="button" size="icon" variant={design.logo.align === a ? "secondary" : "ghost"} aria-label={`Align ${a}`} onClick={() => set("logo", { align: a })}><Icon /></Button>
                ))}
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => set("logo", { url: null })}><Trash2 /> Remove logo</Button>
          </>
        )}
      </div>
    ),
    header: (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="h-title">Title</Label>
          <Input id="h-title" value={design.header.title} onChange={(e) => set("header", { title: e.target.value })} />
          <MergeChips onInsert={(t) => set("header", { title: design.header.title + t })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="h-sub">Subtitle</Label>
          <Input id="h-sub" value={design.header.subtitle} onChange={(e) => set("header", { subtitle: e.target.value })} />
          <MergeChips onInsert={(t) => set("header", { subtitle: `${design.header.subtitle} ${t}`.trim() })} />
        </div>
        <ColorField label="Header background" value={design.header.background} onChange={(v) => set("header", { background: v })} />
        <ColorField label="Header text" value={design.header.textColor} onChange={(v) => set("header", { textColor: v })} />
      </div>
    ),
    background: (
      <div className="space-y-4">
        <ColorField label="Page background" value={design.page.background} onChange={(v) => set("page", { background: v })} />
        <ColorField label="Paper (content) color" value={design.page.content} onChange={(v) => set("page", { content: v })} />
        <ColorField label="Text color" value={design.page.text} onChange={(v) => set("page", { text: v })} />
        <ColorField label="Accent (headings, buttons)" value={design.page.accent} onChange={(v) => set("page", { accent: v })} />
        <div className="space-y-1.5">
          <Label>Font</Label>
          <div className="inline-flex rounded-lg border p-0.5 text-sm">
            {(["sans", "serif"] as const).map((f) => (
              <button key={f} type="button" onClick={() => set("page", { font: f })} className={cn("rounded-md px-3 py-1", design.page.font === f ? "bg-muted font-medium" : "text-muted-foreground", f === "serif" && "font-serif")}>
                {f === "sans" ? "Sans serif" : "Serif"}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
    footerBg: (
      <div className="space-y-4">
        <ColorField label="Footer background" value={design.footer.background} onChange={(v) => set("footer", { background: v })} />
        <ColorField label="Footer text" value={design.footer.textColor} onChange={(v) => set("footer", { textColor: v })} />
      </div>
    ),
    footer: (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="f-text">Footer text</Label>
          <Textarea id="f-text" rows={4} value={design.footer.text} onChange={(e) => set("footer", { text: e.target.value })}
            placeholder={"Company name · Address\nPhone · Email"} />
          <MergeChips onInsert={(t) => set("footer", { text: design.footer.text + t })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-links">Links or extra line</Label>
          <Input id="f-links" value={design.footer.links} onChange={(e) => set("footer", { links: e.target.value })} placeholder="yourcompany.com · linkedin.com/company/you" />
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          Show “Summarized by Echo”
          <Switch checked={design.footer.poweredBy} onCheckedChange={(v) => set("footer", { poweredBy: v })} />
        </label>
      </div>
    ),
    blocks: (
      <ul className="space-y-2">
        {design.blocks.map((b, i) => (
          <li key={b.id} className={cn("flex items-center gap-2 rounded-lg border p-2.5", !b.enabled && "opacity-60")}>
            <Switch checked={b.enabled} aria-label={`Show ${BLOCKS[b.id].label}`}
              onCheckedChange={(v) => setDesign((d) => ({ ...d, blocks: d.blocks.map((x) => (x.id === b.id ? { ...x, enabled: v } : x)) }))} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{BLOCKS[b.id].label}</p>
              <p className="truncate text-xs text-muted-foreground">{BLOCKS[b.id].hint}</p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => blockMove(i, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === design.blocks.length - 1} onClick={() => blockMove(i, 1)}><ArrowDown /></Button>
          </li>
        ))}
      </ul>
    ),
    save: (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="d-name">Design name</Label>
          <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Qallus client summary" maxLength={100} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-ws">Who can use it</Label>
          <select id="d-ws" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm">
            <option value="">Only me</option>
            {workspaces.filter((w) => !w.isPersonal).map((w) => <option key={w.id} value={w.id}>Everyone in {w.name}</option>)}
          </select>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          Use as my default design
          <Switch checked={makeDefault} onCheckedChange={setMakeDefault} />
        </label>
        <Button className="w-full" onClick={save} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Save />} Save design</Button>
      </div>
    ),
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_300px]">
      {/* Steps */}
      <nav aria-label="Builder steps" className="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">
        {STEPS.map((s, i) => (
          <button key={s.id} type="button" onClick={() => go(s.id)} aria-current={step === s.id ? "step" : undefined}
            className={cn("flex shrink-0 items-center gap-3 rounded-xl border p-2.5 text-left transition-colors xl:w-full",
              step === s.id ? "border-foreground bg-muted/50" : "hover:bg-muted/40")}>
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              step === s.id ? "border-foreground bg-foreground text-background" : visited.has(s.id) && "bg-muted")}>
              {visited.has(s.id) && step !== s.id ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{s.title}</span>
              <span className="hidden truncate text-xs text-muted-foreground xl:block">{s.hint}</span>
            </span>
          </button>
        ))}
      </nav>

      {/* Canvas */}
      <div className="order-last min-w-0 overflow-hidden rounded-2xl border xl:order-none">
        <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
          <span>Live preview · click any part to edit it</span>
          <span>{name || "Untitled design"}</span>
        </div>
        <div className="max-h-[calc(100svh-12rem)] overflow-y-auto">
          <SummaryDocument design={design} data={preview} values={values} selected={step === "blocks" ? "body" : step === "footerBg" ? "footer" : step}
            onSelect={(part) => go(PART_STEP[part] ?? "blocks")} />
        </div>
      </div>

      {/* Settings */}
      <aside className="h-fit space-y-4 rounded-2xl border p-4 xl:sticky xl:top-4">
        <div>
          <p className="text-xs text-muted-foreground">Step {index + 1} of {STEPS.length}</p>
          <h2 className="font-semibold">{STEPS[index].title}</h2>
          <p className="text-sm text-muted-foreground">{STEPS[index].hint}</p>
        </div>
        {settings[step]}
        {message && <p className={cn("text-sm", message.error ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>{message.text}</p>}
        <div className="flex justify-between gap-2 border-t pt-3">
          <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => go(STEPS[index - 1].id)}><ArrowLeft /> Back</Button>
          {index < STEPS.length - 1
            ? <Button size="sm" onClick={() => go(STEPS[index + 1].id)}>Next <ArrowRight /></Button>
            : <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/templates" />}>Done</Button>}
        </div>
      </aside>
    </div>
  );
}
