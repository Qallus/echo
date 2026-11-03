"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ClipboardList, Copy, Eye, GalleryHorizontal, IdCard, Image as ImageIcon, Layers, Link as LinkIcon, ListChecks,
  Nfc, Palette, PlayCircle, QrCode, Save, Settings, User, Wand2, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardPreview } from "@/components/cards/card-preview";
import { saveCard } from "@/lib/admin/actions/cards";
import { cardPath, type Card, type CardDesign } from "@/lib/cards/types";
import type { StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { PanelBody, type PanelKey } from "./card-panels";

const PANELS: { key: PanelKey; label: string; icon: typeof User }[] = [
  { key: "sections", label: "Sections", icon: Layers },
  { key: "content", label: "Content", icon: User },
  { key: "links", label: "Links", icon: LinkIcon },
  { key: "color", label: "Color modes", icon: Palette },
  { key: "splash", label: "Splash page", icon: PlayCircle },
  { key: "qr", label: "QR code", icon: QrCode },
  { key: "forms", label: "Forms", icon: ClipboardList },
  { key: "nfc", label: "NFC", icon: Nfc },
  { key: "slideshow", label: "Slideshow", icon: GalleryHorizontal },
  { key: "media", label: "Media", icon: ImageIcon },
  { key: "steps", label: "Steps", icon: ListChecks },
  { key: "automate", label: "Automations", icon: Zap },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "wizard", label: "Setup wizard", icon: Wand2 },
];

export type Draft = Card;
export type SetDraft = (fn: (d: Draft) => Draft) => void;

// Full-page card builder: panel rail, the panel's fields, and a live preview.
export function CardBuilder({ card, staff, canAssign, origin }: { card: Card; staff: StaffOption[]; canAssign: boolean; origin: string }) {
  const router = useRouter();
  const [draft, setDraftState] = useState<Draft>(card);
  const [panel, setPanel] = useState<PanelKey>(card.id ? "content" : "wizard");
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const setDraft: SetDraft = (fn) => { setDraftState(fn); setDirty(true); };
  const setDesign = (fn: (d: CardDesign) => CardDesign) => setDraft((d) => ({ ...d, design: fn(d.design) }));
  const publicUrl = `${origin}${cardPath(draft.slug || "preview")}`;

  const persist = (status?: Card["status"]) => start(async () => {
    const next = status ? { ...draft, status } : draft;
    const r = await saveCard(next);
    setMsg(r);
    if (r.error) return;
    setDirty(false);
    if (status) setDraftState(next);
    if (!draft.id && r.id) router.replace(`/admin/cards/${r.id}`);
    else router.refresh();
  });

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-1px)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin/cards" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            onClick={(e) => { if (dirty && !confirm("Leave without saving your changes?")) e.preventDefault(); }}><ArrowLeft className="size-4" /> Back</Link>
          <span className="flex min-w-0 items-center gap-2 text-lg font-semibold"><IdCard className="size-4 shrink-0" /><span className="truncate">{draft.id ? "Edit card" : "New card"}</span></span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", draft.status === "published" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
            {draft.status === "published" ? "Published" : draft.status === "archived" ? "Archived" : draft.status === "unpublished" ? "Unpublished" : "Draft"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {msg.error ? <span className="text-xs font-medium text-destructive">{msg.error}</span> : msg.ok && !dirty ? <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{msg.ok}</span> : dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
          <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(publicUrl); setMsg({ ok: "Link copied." }); }}><Copy /> Copy URL</Button>
          {draft.id && draft.status === "published" && <Button size="sm" variant="outline" render={<a href={cardPath(draft.slug)} target="_blank" rel="noopener noreferrer" />} nativeButton={false}><Eye /> Public page</Button>}
          {draft.status !== "published" && <Button size="sm" variant="outline" disabled={pending} onClick={() => persist("published")}>Publish &amp; save</Button>}
          <Button size="sm" disabled={pending} onClick={() => persist()}><Save /> {pending ? "Saving…" : "Save card"}</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav aria-label="Builder panels" className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 lg:w-44 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
          {PANELS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setPanel(key)} aria-current={panel === key ? "page" : undefined}
              className={cn("flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition lg:w-full", panel === key ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <Icon className="size-4 shrink-0" /><span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
        <div className="shrink-0 border-b p-4 lg:w-[400px] lg:overflow-y-auto lg:border-r lg:border-b-0">
          <PanelBody panel={panel} draft={draft} setDraft={setDraft} setDesign={setDesign} staff={staff} canAssign={canAssign} publicUrl={publicUrl} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col bg-muted/40 p-5 lg:overflow-y-auto">
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Live preview</p>
            <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
              {(["mobile", "tablet", "desktop"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDevice(d)} className={cn("rounded-md px-3 py-1 font-medium capitalize", device === d ? "bg-accent text-foreground" : "text-muted-foreground")}>{d}</button>
              ))}
            </div>
          </div>
          <div className={cn("mx-auto w-full", device === "mobile" ? "max-w-[360px]" : device === "tablet" ? "max-w-[460px]" : "max-w-[560px]")}>
            <CardPreview card={draft} publicUrl={publicUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
