"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, MoreHorizontal, Nfc, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteCard, deleteCardLeads } from "@/lib/admin/actions/cards";
import { cardPath, EMPTY_STATS, type Card, type CardLead, type CardStats } from "@/lib/cards/types";
import { ownerName, type StaffOption } from "@/lib/crm/types";
import { StatRow, StatTile } from "@/components/admin/crm/crm-kit";
import { BulkBar } from "@/components/admin/crm/bulk-bar";
import { blankCard, CardBuilder } from "./card-builder";

type NDEFReaderLike = { write: (msg: { records: { recordType: string; data: string }[] }) => Promise<void> };

// Digital business cards: one per person, with views, saves, clicks and the
// contacts people leave on them.
export function CardsPanel({ cards, stats, leads, staff, me, origin, canManage }: {
  cards: Card[]; stats: CardStats; leads: CardLead[]; staff: StaffOption[]; me: string; origin: string; canManage: boolean;
}) {
  const [editing, setEditing] = useState<Parameters<typeof CardBuilder>[0]["card"] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  const total = Object.values(stats).reduce((t, s) => ({ view: t.view + s.view, save: t.save + s.save, click: t.click + s.click, lead: t.lead + s.lead }), { view: 0, save: 0, click: 0, lead: 0 });
  const urlOf = (c: Card) => `${origin}${cardPath(c.slug)}`;
  const canEdit = (c: Card) => canManage || c.owner_id === me;
  const cardName = (id: string) => cards.find((c) => c.id === id)?.full_name ?? "Card";

  async function downloadQr(c: Card) {
    const png = await QRCode.toDataURL(`${urlOf(c)}?src=qr`, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
    const a = document.createElement("a");
    a.href = png; a.download = `${c.slug}-qr.png`; a.click();
  }
  async function writeNfc(c: Card) {
    const W = window as unknown as { NDEFReader?: new () => NDEFReaderLike };
    if (!W.NDEFReader) { setMsg("Writing NFC tags works in Chrome on Android. Open this page there, then tap Write NFC tag."); return; }
    try {
      setMsg("Hold an NFC tag to the back of your phone…");
      await new W.NDEFReader().write({ records: [{ recordType: "url", data: `${urlOf(c)}?src=nfc` }] });
      setMsg(`NFC tag written for ${c.full_name}.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't write the tag."); }
  }

  return (
    <div className="space-y-6">
      <StatRow>
        <StatTile label="Views (30 days)" value={total.view} />
        <StatTile label="Contacts saved" value={total.save} />
        <StatTile label="Link clicks" value={total.click} />
        <StatTile label="New leads" value={total.lead} accent />
      </StatRow>

      <Tabs defaultValue="cards">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList><TabsTrigger value="cards">Cards ({cards.length})</TabsTrigger><TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger></TabsList>
          <div className="flex items-center gap-2">
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            <Button onClick={() => setEditing(blankCard(me))}><Plus /> New card</Button>
          </div>
        </div>

        <TabsContent value="cards" className="pt-4">
          {cards.length === 0 ? <p className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">No cards yet. Create one for each person who hands out cards.</p> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((c) => {
                const s = stats[c.id] ?? EMPTY_STATS;
                return (
                  <div key={c.id} className="space-y-4 rounded-xl border bg-card p-4">
                    <div className="flex items-start gap-3">
                      {c.photo_url
                        ? <img src={c.photo_url} alt="" className="size-12 rounded-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                        : <span className="grid size-12 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: c.accent }}>{c.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.full_name}</p>
                        <p className="truncate text-sm text-muted-foreground">{[c.title, c.company].filter(Boolean).join(" · ") || "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.owner_id ? ownerName(staff, c.owner_id) : "No owner"}</p>
                      </div>
                      {!c.active && <Badge variant="outline">Off</Badge>}
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Actions for ${c.full_name}`} />}><MoreHorizontal /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem render={<a href={cardPath(c.slug)} target="_blank" rel="noopener noreferrer" />}><ExternalLink /> Open card</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { void navigator.clipboard.writeText(urlOf(c)); setMsg("Link copied."); }}><Copy /> Copy link</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void downloadQr(c)}><Download /> Download QR code</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void writeNfc(c)}><Nfc /> Write NFC tag</DropdownMenuItem>
                          {canEdit(c) && <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditing(c)}><Pencil /> Edit</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => confirm(`Delete ${c.full_name}'s card? Its link stops working.`) && start(async () => { const r = await deleteCard(c.id); setMsg(r.error ?? r.ok); })}><Trash2 /> Delete</DropdownMenuItem>
                          </>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <dl className="grid grid-cols-4 gap-2 text-center">
                      {([["Views", s.view], ["Saves", s.save], ["Clicks", s.click], ["Leads", s.lead]] as const).map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-muted/50 py-2"><dt className="text-[0.7rem] text-muted-foreground">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
                      ))}
                    </dl>
                    <p className="truncate text-xs text-muted-foreground">{s.qr} from QR · {s.nfc} from NFC · {s.share} shares</p>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leads" className="space-y-3 pt-4">
          <BulkBar count={selected.size} total={leads.length} pending={pending} onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(leads.map((l) => l.id)))}
            actions={canManage ? [{ label: "Remove", icon: Trash2, destructive: true, run: () => confirm(`Remove ${selected.size} leads from this list? Their CRM contacts stay.`) && start(async () => { const r = await deleteCardLeads([...selected]); setMsg(r.error ?? r.ok); if (!r.error) setSelected(new Set()); }) }] : []} />
          {leads.length === 0 ? <p className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">When someone shares their details from a card, they show up here and in Contacts.</p> : (
            <ul className="divide-y rounded-xl border bg-card">
              {leads.map((l) => (
                <li key={l.id} className="flex items-start gap-3 p-3">
                  <input type="checkbox" className="mt-1" aria-label={`Select ${l.name}`} checked={selected.has(l.id)}
                    onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} />
                  <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                    <p className="font-medium">{l.name}{l.company && <span className="font-normal text-muted-foreground"> · {l.company}</span>}</p>
                    <p className="truncate text-muted-foreground">{[l.email, l.phone].filter(Boolean).join(" · ")}</p>
                    {l.message && <p className="line-clamp-2">{l.message}</p>}
                    <p className="text-xs text-muted-foreground">From {cardName(l.card_id)}&apos;s card · {new Date(l.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  {l.contact_id && <Button size="sm" variant="outline" render={<Link href={`/admin/contacts/${l.contact_id}`} />} nativeButton={false}>Open contact</Button>}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {editing && <CardBuilder key={editing.id ?? "new"} card={editing} staff={staff} canAssign={canManage} onClose={() => setEditing(null)} />}
    </div>
  );
}
