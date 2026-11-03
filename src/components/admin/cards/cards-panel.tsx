"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, BarChart3, Check, Copy, Eye, IdCard, Mail, MousePointerClick, Nfc, Pencil, Phone, Plus, QrCode, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQr } from "@/components/cards/card-preview";
import { deleteCard, deleteCardLeads, setCardStatus, setLeadStatus, setNfcStatus } from "@/lib/admin/actions/cards";
import { cardName, cardPath, EMPTY_TOTALS, type Card, type CardLead, type CardStats, type LeadStatus } from "@/lib/cards/types";
import { ownerName, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { BulkBar } from "@/components/admin/crm/bulk-bar";
import { NfcDialog } from "./nfc";

const LEAD_STATUSES: { id: LeadStatus; label: string; cls: string }[] = [
  { id: "new", label: "New", cls: "bg-primary/10 text-foreground" },
  { id: "contacted", label: "Contacted", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  { id: "qualified", label: "Qualified", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  { id: "archived", label: "Archived", cls: "bg-muted text-muted-foreground" },
];

// Digital business cards: stats, the card list and the leads inbox.
export function CardsPanel({ cards, stats, leads, staff, me, origin, canManage, initialTab }: {
  cards: Card[]; stats: CardStats; leads: CardLead[]; staff: StaffOption[]; me: string; origin: string; canManage: boolean; initialTab: "cards" | "leads";
}) {
  const [tab, setTab] = useState(initialTab);
  const [scope, setScope] = useState<"mine" | "all">(canManage ? "all" : "mine");
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [nfcCard, setNfcCard] = useState<Card | null>(null);
  const [msg, setMsg] = useState<string>();
  const [, start] = useTransition();
  const router = useRouter();

  const mine = scope === "mine" ? cards.filter((c) => c.owner_id === me) : cards;
  const ids = new Set(mine.map((c) => c.id));
  const shown = mine.filter((c) => filter === "all" ? c.status !== "archived" : filter === "draft" ? c.status === "draft" || c.status === "unpublished" : c.status === filter);
  const myLeads = leads.filter((l) => ids.has(l.card_id));
  const sum = (k: keyof typeof EMPTY_TOTALS) => mine.reduce((n, c) => n + (stats[c.id]?.[k] ?? 0), 0);
  const tiles = [
    ["Cards", mine.length, "Total cards"], ["Published", mine.filter((c) => c.status === "published").length, "Live links"],
    ["Views", sum("view") + sum("qr") + sum("nfc"), "Card opens"], ["Clicks", sum("click"), "Links and buttons"],
    ["NFC ready", mine.filter((c) => c.nfc_status === "assigned" || c.nfc_status === "active").length, "Linked to a tag"],
    ["Shares", sum("share"), "Card shared"], ["Saves", sum("save"), "Contacts saved"], ["Leads", myLeads.length, "Info sent to you"],
  ] as const;
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => { const r = await fn(); setMsg(r.error ?? r.ok); });
  const newLeads = myLeads.filter((l) => l.status === "new").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 border-b">
          {(["cards", "leads"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setTab(v)} className={cn("-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium", tab === v ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {v === "cards" ? <IdCard className="size-4" /> : <Mail className="size-4" />}{v === "cards" ? "Cards" : "Leads"}
              {v === "leads" && newLeads > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground">{newLeads}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
          {canManage && (
            <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
              <button type="button" onClick={() => setScope("mine")} className={cn("rounded-md px-3 py-1.5 font-medium", scope === "mine" ? "bg-accent text-foreground" : "text-muted-foreground")}>My cards</button>
              <button type="button" onClick={() => setScope("all")} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 font-medium", scope === "all" ? "bg-accent text-foreground" : "text-muted-foreground")}><Users className="size-3.5" />Everyone</button>
            </div>
          )}
          <Button render={<Link href="/admin/cards/new" />} nativeButton={false}><Plus /> Create card</Button>
        </div>
      </div>

      {tab === "leads" ? <LeadsInbox leads={myLeads} cards={cards} canManage={canManage} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {tiles.map(([label, value, hint]) => (
              <div key={label} className="rounded-xl border bg-card px-4 py-3">
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "published", "draft", "archived"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", filter === f ? "border-foreground bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {f === "all" ? "All" : f === "published" ? "Published" : f === "draft" ? "Drafts" : "Archived"}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center">
              <IdCard className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm font-medium">No cards here</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">Create a digital business card to get a public page with a QR code and NFC tap.</p>
              <Button size="sm" className="mt-4" render={<Link href="/admin/cards/new" />} nativeButton={false}><Plus /> Create card</Button>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {shown.map((c) => (
                <CardRow key={c.id} card={c} url={`${origin}${cardPath(c.slug)}`} totals={stats[c.id] ?? EMPTY_TOTALS} owner={scope === "all" ? (c.owner_id ? ownerName(staff, c.owner_id) : "No owner") : null}
                  canEdit={canManage || c.owner_id === me} onNfc={() => setNfcCard(c)}
                  onStatus={(s) => run(() => setCardStatus(c.id, s))}
                  onDelete={() => confirm(`Delete "${cardName(c)}"? Its link stops working.`) && run(() => deleteCard(c.id))}
                  onCopied={() => setMsg("Link copied.")} />
              ))}
            </div>
          )}
        </>
      )}

      {nfcCard && (
        <NfcDialog open onOpenChange={(o) => { if (!o) { setNfcCard(null); router.refresh(); } }} name={cardName(nfcCard)}
          tagUrl={`${origin}${cardPath(nfcCard.slug)}?src=nfc`} writerUrl={`${origin}/admin/cards/${nfcCard.id}/nfc`}
          onWritten={() => void setNfcStatus(nfcCard.id, "active")} />
      )}
    </div>
  );
}

function CardRow({ card, url, totals, owner, canEdit, onNfc, onStatus, onDelete, onCopied }: {
  card: Card; url: string; totals: typeof EMPTY_TOTALS; owner: string | null; canEdit: boolean;
  onNfc: () => void; onStatus: (s: Card["status"]) => void; onDelete: () => void; onCopied: () => void;
}) {
  const qr = useQr(`${url}?src=qr`, 200);
  const big = useQr(`${url}?src=qr`, 1024);
  const published = card.status === "published";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {card.profile_photo_url
            ? <img src={card.profile_photo_url} alt="" className="size-11 shrink-0 rounded-full object-cover" /> // eslint-disable-line @next/next/no-img-element
            : <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold" style={{ background: card.background_color, color: card.accent_color, border: "1px solid var(--border)" }}>{cardName(card).slice(0, 1)}</span>}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold">{cardName(card)}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", published ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                {published ? "Published" : card.status === "archived" ? "Archived" : card.status === "unpublished" ? "Unpublished" : "Draft"}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{[card.job_title, card.company_name].filter(Boolean).join(" · ") || url.replace(/^https?:\/\//, "")}</p>
            {owner && <p className="mt-0.5 text-[11px] text-muted-foreground">Owner: {owner}</p>}
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Eye className="size-3" />{totals.view + totals.qr + totals.nfc}</span>
              <span className="flex items-center gap-1"><MousePointerClick className="size-3" />{totals.click}</span>
              <span className="flex items-center gap-1"><Mail className="size-3" />{totals.lead}</span>
              {(card.nfc_status === "assigned" || card.nfc_status === "active") && <span className="flex items-center gap-1"><Nfc className="size-3" />NFC</span>}
            </div>
          </div>
        </div>
        <div className="shrink-0 rounded-lg border bg-white p-1.5">{qr ? <img src={qr} alt="" className="size-16" /> : <div className="size-16" />}</div> {/* eslint-disable-line @next/next/no-img-element */}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {canEdit && <Button size="sm" render={<Link href={`/admin/cards/${card.id}`} />} nativeButton={false}><Pencil /> Edit</Button>}
        <Button size="sm" variant="outline" render={<Link href={`/admin/cards/${card.id}/analytics`} />} nativeButton={false}><BarChart3 /> Analytics</Button>
        <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(url); onCopied(); }}><Copy /> Copy link</Button>
        {published && <Button size="sm" variant="outline" render={<a href={cardPath(card.slug)} target="_blank" rel="noopener noreferrer" />} nativeButton={false}><Eye /> Public page</Button>}
        <Button size="sm" variant="outline" disabled={!big} render={<a href={big ?? "#"} download={`${card.slug}-qr.png`} />} nativeButton={false}><QrCode /> QR PNG</Button>
        <Button size="sm" variant="outline" onClick={onNfc}><Nfc /> Write NFC</Button>
        {canEdit && <>
          <Button size="sm" variant="outline" onClick={() => onStatus(published ? "unpublished" : "published")}>{published ? "Unpublish" : "Publish"}</Button>
          {card.status !== "archived" && <Button size="sm" variant="outline" onClick={() => onStatus("archived")}><Archive /> Archive</Button>}
          <Button size="sm" variant="outline" className="text-destructive" onClick={onDelete}><Trash2 /> Delete</Button>
        </>}
      </div>
    </div>
  );
}

function LeadsInbox({ leads, cards, canManage }: { leads: CardLead[]; cards: Card[]; canManage: boolean }) {
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  const shown = useMemo(() => (filter === "all" ? leads.filter((l) => l.status !== "archived") : leads.filter((l) => l.status === filter)), [leads, filter]);
  const cardOf = (id: string) => cards.find((c) => c.id === id);
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => { const r = await fn(); setMsg(r.error ?? r.ok); if (!r.error) setSelected(new Set()); });
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {([["all", "Open"], ...LEAD_STATUSES.map((s) => [s.id, s.label])] as [string, string][]).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id as typeof filter)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", filter === id ? "border-foreground bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {label} <span className="text-muted-foreground">{id === "all" ? leads.filter((l) => l.status !== "archived").length : leads.filter((l) => l.status === id).length}</span>
          </button>
        ))}
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
      <BulkBar count={selected.size} total={shown.length} pending={pending} onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(shown.map((l) => l.id)))}
        actions={[
          { label: "Set status", icon: Check, options: LEAD_STATUSES.map((s) => ({ value: s.id, label: s.label })), onPick: (v) => run(() => setLeadStatus([...selected], v as LeadStatus)) },
          ...(canManage ? [{ label: "Remove", icon: Trash2, destructive: true, run: () => confirm(`Remove ${selected.size} leads from this list? Their CRM contacts stay.`) && run(() => deleteCardLeads([...selected])) }] : []),
        ]} />
      {shown.length === 0 ? <p className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">When someone sends their info from a card, it shows up here and in Contacts.</p> : (
        <ul className="divide-y rounded-xl border bg-card">
          {shown.map((l) => {
            const st = LEAD_STATUSES.find((s) => s.id === l.status)!;
            const card = cardOf(l.card_id);
            return (
              <li key={l.id} className="flex items-start gap-3 p-3">
                <input type="checkbox" className="mt-1" aria-label={`Select ${l.name}`} checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">{l.name}{l.company && <span className="font-normal text-muted-foreground">· {l.company}</span>}<span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", st.cls)}>{st.label}</span></p>
                  <p className="flex flex-wrap gap-x-3 text-muted-foreground">
                    {l.email && <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="size-3" />{l.email}</a>}
                    {l.phone && <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="size-3" />{l.phone}</a>}
                  </p>
                  {l.message && <p className="line-clamp-2">{l.message}</p>}
                  <p className="text-xs text-muted-foreground">From {card ? cardName(card) : "a card"} · {new Date(l.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <select aria-label="Lead status" className="h-7 rounded-md border bg-transparent px-1.5 text-xs dark:bg-input/30" value={l.status} disabled={pending} onChange={(e) => run(() => setLeadStatus([l.id], e.target.value as LeadStatus))}>
                    {LEAD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  {l.contact_id && <Button size="xs" variant="outline" render={<Link href={`/admin/contacts/${l.contact_id}`} />} nativeButton={false}>Open contact</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
