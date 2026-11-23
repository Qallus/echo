"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Check, Contact, Download, GitBranchPlus, Pencil, PhoneOutgoing, Plus, Radar, Settings, Trash2, Upload, UserPlus, Wand2, X, MapPinned } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { downloadCsv } from "@/components/admin/list-csv";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { Textarea } from "@/components/ui/textarea";
import { addProspectsToPipeline, convertProspectsToLeads, deleteProspects, setProspectStatus, updateProspectNotes } from "@/lib/admin/actions/prospects";
import { possibleWhy, PROVIDERS, TALK_TRACKS, type Provider } from "@/lib/prospects/carriers";
import { prettyPhone } from "@/lib/prospects/phone";
import { LINE_TYPES, PROSPECT_STATUSES, type Prospect, type ProspectStatus } from "@/lib/prospects/types";
import { cn } from "@/lib/utils";
import { AddProspectPanel } from "./add-prospect";
import { ImportPanel } from "./import-prospects";
import { FindBusinessesPanel } from "./find-businesses";
import { ProspectWizard } from "./prospect-wizard";
import { LookupPanel } from "./lookup-panel";
import { ProspectSettingsPanel, type Unmapped } from "./prospect-settings";
import type { ProspectingSettings } from "@/lib/prospects/settings";

const provider = (p: Prospect): Provider | null => p.provider;
const statusLabel = (s: ProspectStatus) => PROSPECT_STATUSES.find((x) => x.id === s)?.label ?? s;
const name = (p: Prospect) => p.business_name || prettyPhone(p.phone_e164);
const place = (p: Prospect) => [p.city, p.state].filter(Boolean).join(", ");

// The RingCentral / Cox / Spectrum quick-scan columns: ✓, "possible" or –.
function Mark({ p, is }: { p: Prospect; is: Provider }) {
  if (provider(p) !== is) return <span className="text-muted-foreground">–</span>;
  return p.confidence === "possible"
    ? <span className="text-xs text-amber-700 dark:text-amber-300">possible</span>
    : <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-label="Yes" />;
}

function ProviderBadge({ p }: { p: Prospect }) {
  const pr = provider(p);
  if (!pr) return <span className="text-xs text-muted-foreground">Not looked up</span>;
  // (✓ you = confirmed on this prospect, overriding the lookup)
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium", PROVIDERS[pr].tone)}>
      {PROVIDERS[pr].label}{p.confidence === "possible" ? " (possible)" : ""}{p.providerByYou ? " ✓ you" : ""}
    </span>
  );
}

function Score({ p }: { p: Prospect }) {
  const s = p.score ?? 0;
  return <span className={cn("inline-flex min-w-8 justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
    s >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : s >= 35 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{s}</span>;
}

function exportCsv(list: Prospect[]) {
  downloadCsv(`prospects-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Business", "Phone", "Ext", "Contact first name", "Contact last name", "Title", "Email", "Category", "Locations", "Address", "Suite", "City", "State", "ZIP", "Country", "Tags", "Website", "Line type", "Carrier", "Provider", "Confidence", "Caller name", "Score", "Status", "Looked up"],
    list.map((p) => [p.business_name, p.phone_e164, p.phone_ext, p.contact_first_name, p.contact_last_name, p.contact_title, p.email, p.category, p.locations, p.address, p.address2, p.city, p.state, p.zip, p.country, (p.tags ?? []).join(", "), p.website, p.lookup?.line_type, p.lookup?.carrier_name,
      provider(p) ? PROVIDERS[provider(p)!].label : "", p.confidence, p.lookup?.caller_name, p.score, statusLabel(p.status), p.lookup?.looked_up_at?.slice(0, 10)]));
}

export function ProspectsList({ rows, manage, canRun, canSettings, settings, unmapped }: {
  rows: Prospect[]; manage: boolean; canRun: boolean; canSettings: boolean; settings: ProspectingSettings; unmapped: Unmapped[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [panel, setPanel] = useState<"wizard" | "import" | "add" | "places" | null>(null);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [lookup, setLookup] = useState<{ ids: string[] | null; label: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const notLookedUp = rows.filter((p) => !p.lookup && p.status !== "dnc").length;
  const counts = {
    total: rows.length, lookedUp: rows.filter((p) => p.lookup).length, dnc: rows.filter((p) => p.status === "dnc").length,
    hot: rows.filter((p) => (p.score ?? 0) >= 60 && p.status !== "dnc").length,
    unplaced: rows.filter((p) => p.latitude == null && (p.city || p.address)).length,
  };
  const [msg, setMsg] = useState<{ ok?: string; error?: string; href?: string; link?: string }>({});
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => { const r = await fn(); if (r.error) setMsg({ error: r.error }); router.refresh(); });
  };
  const toCrm = (list: Prospect[], where: "leads" | "pipeline") => start(async () => {
    const r = where === "leads" ? await convertProspectsToLeads(list.map((p) => p.id)) : await addProspectsToPipeline(list.map((p) => p.id));
    setMsg(r.error ? { error: r.error } : where === "leads"
      ? { ok: r.ok, href: list.length === 1 && r.id ? `/admin/contacts/${r.id}` : "/admin/leads", link: list.length === 1 && r.id ? "Open the lead" : "Open Leads" }
      : { ok: r.ok, href: list.length === 1 && r.id ? `/admin/pipeline/${r.id}` : "/admin/pipeline", link: list.length === 1 && r.id ? "Open the deal" : "Open the pipeline" });
    router.refresh();
  });
  const setStatus = (list: Prospect[], status: ProspectStatus) => run(() => setProspectStatus(list.map((p) => p.id), status),
    status === "dnc" ? `Mark ${list.length} as Do not contact? This can't be undone.` : undefined);

  return (
    <>
    {panel === "wizard" && <ProspectWizard counts={counts} manage={manage} canRun={canRun} onClose={() => setPanel(null)} onImport={() => setPanel("import")} onAdd={() => setPanel("add")} onFind={() => setPanel("places")}
      onLookup={() => { setPanel(null); setLookup({ ids: null, label: `${notLookedUp} not looked up yet` }); }} />}
    {panel === "import" && <ImportPanel onClose={() => setPanel(null)} />}
    {panel === "places" && <FindBusinessesPanel pageCents={settings.placesPageCents} onClose={() => setPanel(null)} />}
    {panel === "add" && <AddProspectPanel onClose={() => setPanel(null)} />}
    {lookup && <LookupPanel ids={lookup.ids} label={lookup.label} onClose={() => setLookup(null)} />}
    {showSettings && <ProspectSettingsPanel settings={settings} unmapped={unmapped} canEdit={canSettings} onClose={() => setShowSettings(false)} />}
    {editing && <AddProspectPanel key={editing.id} prospect={editing} onClose={() => setEditing(null)} />}
    {(msg.ok || msg.error) && (
      <p className={cn("mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", msg.error ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted/40")}>
        <span className="flex-1">{msg.error ?? msg.ok}{msg.href && <> <Link href={msg.href} className="font-medium underline">{msg.link}</Link></>}</span>
        <button type="button" aria-label="Dismiss" onClick={() => setMsg({})} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </p>
    )}
    <CollectionView<Prospect>
      items={rows} getId={(p) => p.id} title={name} noun={["prospect", "prospects"]} storageKey="admin-prospects" defaultView="table"
      subtitle={(p) => [prettyPhone(p.phone_e164), p.category, place(p)].filter(Boolean).join(" · ")}
      badge={(p) => <ProviderBadge p={p} />}
      meta={(p) => <>Score {p.score ?? 0} · {statusLabel(p.status)}{p.lookup?.carrier_name ? ` · ${p.lookup.carrier_name}` : ""}</>}
      location={(p) => (p.latitude != null && p.longitude != null ? { lat: p.latitude, lng: p.longitude } : null)}
      date={(p) => p.created_at}
      toolbar={
        <>
          <Button variant="outline" onClick={() => setPanel("wizard")}><Wand2 /> Wizard</Button>
          {canRun && manage && <Button variant="outline" onClick={() => setPanel("places")}><MapPinned /> Find businesses</Button>}
          {canRun && <Button variant="outline" disabled={!notLookedUp} title={notLookedUp ? undefined : "Everything has been looked up"}
            onClick={() => setLookup({ ids: null, label: `${notLookedUp} not looked up yet` })}><Radar /> Look up{notLookedUp ? ` (${notLookedUp})` : ""}</Button>}
          <Button variant="outline" size="icon" aria-label="Prospecting settings" title="Settings: prices, cap, unmapped carriers" onClick={() => setShowSettings(true)}><Settings /></Button>
          <Button variant="outline" onClick={() => exportCsv(rows)} disabled={!rows.length}><Download /> Export</Button>
          {manage && <Button variant="outline" onClick={() => setPanel("import")}><Upload /> Import</Button>}
          {manage && <Button onClick={() => setPanel("add")}><Plus /> Add prospect</Button>}
        </>
      }
      searchText={(p) => `${p.business_name ?? ""} ${p.contact_first_name ?? ""} ${p.contact_last_name ?? ""} ${p.email ?? ""} ${p.zip ?? ""} ${(p.tags ?? []).join(" ")} ${p.phone_e164} ${prettyPhone(p.phone_e164)} ${p.category ?? ""} ${p.city ?? ""} ${p.state ?? ""} ${p.lookup?.carrier_name ?? ""} ${p.lookup?.caller_name ?? ""} ${provider(p) ? PROVIDERS[provider(p)!].label : ""}`}
      filters={[
        { id: "all", label: "All", test: (p) => p.status !== "dnc" },
        { id: "rc", label: "RingCentral confirmed", test: (p) => provider(p) === "ringcentral" && p.confidence === "confirmed" },
        { id: "rc-any", label: "RingCentral (incl. possible)", test: (p) => provider(p) === "ringcentral" },
        { id: "cox", label: "Cox", test: (p) => provider(p) === "cox" },
        { id: "spectrum", label: "Spectrum", test: (p) => provider(p) === "spectrum" },
        { id: "mobile", label: "Mobile", test: (p) => provider(p) === "mobile" },
        { id: "landline", label: "Landline", test: (p) => provider(p) === "lumen" || provider(p) === "landline" },
        { id: "voip", label: "Other VoIP", test: (p) => provider(p) === "other_voip" },
        { id: "todo", label: "Not looked up", test: (p) => !p.lookup },
        { id: "hot", label: "Score 60+", test: (p) => (p.score ?? 0) >= 60 && p.status !== "dnc" },
        { id: "dnc", label: "Do not contact", test: (p) => p.status === "dnc" },
      ]}
      columns={[
        { id: "name", label: "Business", sort: (p) => name(p).toLowerCase(), cell: (p) => <span className="min-w-0"><span className="block truncate font-medium">{name(p)}</span><span className="block text-xs text-muted-foreground tabular-nums">{prettyPhone(p.phone_e164)}</span></span> },
        { id: "category", label: "Category", sort: (p) => p.category ?? "", cell: (p) => p.category ?? <span className="text-muted-foreground">—</span> },
        { id: "city", label: "City", sort: (p) => place(p), cell: (p) => place(p) || <span className="text-muted-foreground">—</span> },
        { id: "line", label: "Line type", sort: (p) => p.lookup?.line_type ?? "", cell: (p) => (p.lookup?.line_type ? LINE_TYPES[p.lookup.line_type] ?? p.lookup.line_type : <span className="text-muted-foreground">—</span>) },
        { id: "provider", label: "Provider", sort: (p) => (provider(p) ? PROVIDERS[provider(p)!].label : "~"), cell: (p) => <ProviderBadge p={p} /> },
        { id: "rc", label: "RingCentral", sort: (p) => (provider(p) === "ringcentral" ? (p.confidence === "confirmed" ? 2 : 1) : 0), cell: (p) => <Mark p={p} is="ringcentral" /> },
        { id: "cox", label: "Cox", sort: (p) => Number(provider(p) === "cox"), cell: (p) => <Mark p={p} is="cox" /> },
        { id: "spectrum", label: "Spectrum", sort: (p) => Number(provider(p) === "spectrum"), cell: (p) => <Mark p={p} is="spectrum" /> },
        { id: "cnam", label: "Caller name", sort: (p) => p.lookup?.caller_name ?? "", cell: (p) => p.lookup?.caller_name ?? <span className="text-muted-foreground">—</span> },
        { id: "score", label: "Score", sort: (p) => p.score ?? 0, cell: (p) => <Score p={p} /> },
        { id: "status", label: "Status", sort: (p) => p.status, cell: (p) => <Badge variant={p.status === "dnc" ? "destructive" : "outline"}>{statusLabel(p.status)}</Badge> },
        { id: "looked", label: "Looked up", sort: (p) => p.lookup?.looked_up_at ?? "", cell: (p) => (p.lookup ? <span className="text-muted-foreground"><LocalDate iso={p.lookup.looked_up_at} short /></span> : <span className="text-muted-foreground">—</span>) },
      ]}
      actions={[
        { label: "Export CSV", icon: Download, run: (list) => exportCsv(list) },
        ...(canRun ? [{ label: "Look up carriers", icon: Radar, run: (list: Prospect[]) => setLookup({ ids: list.map((p) => p.id), label: `${list.length} selected` }) }] : []),
        ...(manage ? [
          { label: "Convert to lead", icon: UserPlus, run: (list: Prospect[]) => toCrm(list, "leads") },
          { label: "Add to pipeline", icon: GitBranchPlus, run: (list: Prospect[]) => toCrm(list, "pipeline") },
          { label: "Mark contacted", icon: PhoneOutgoing, run: (list: Prospect[]) => setStatus(list, "contacted") },
          { label: "Do not contact", icon: Ban, run: (list: Prospect[]) => setStatus(list, "dnc"), destructive: true },
          { label: "Delete", icon: Trash2, run: (list: Prospect[]) => run(() => deleteProspects(list.map((p) => p.id)), `Delete ${list.length} prospect${list.length === 1 ? "" : "s"}?`), destructive: true },
        ] : []),
      ]}
      previewActions={(p, close) => (
        <>
          {manage && <Button size="sm" variant="outline" onClick={() => { close(); setEditing(p); }}><Pencil /> Edit</Button>}
          {manage && !p.crm_contact_id && p.status !== "dnc" && <Button size="sm" variant="outline" onClick={() => { close(); toCrm([p], "leads"); }}><UserPlus /> Convert to lead</Button>}
          {manage && p.status !== "dnc" && <Button size="sm" variant="outline" onClick={() => { close(); toCrm([p], "pipeline"); }}><GitBranchPlus /> Add to pipeline</Button>}
          {p.crm_contact_id && <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/admin/contacts/${p.crm_contact_id}`} />}><Contact /> Open lead</Button>}
        </>
      )}
      preview={(p) => <ProspectPreview p={p} manage={manage} onStatus={(s) => setStatus([p], s)} />}
      empty="No prospects yet. Use Import or Add prospect, or open the Wizard for a walk-through."
    />
    </>
  );
}

function ProspectPreview({ p, manage, onStatus }: { p: Prospect; manage: boolean; onStatus: (s: ProspectStatus) => void }) {
  const router = useRouter();
  const [notes, setNotes] = useState(p.notes ?? "");
  const [saving, start] = useTransition();
  const pr = provider(p);
  const l = p.lookup;
  const rows: [string, React.ReactNode][] = [
    ["Phone", <a key="t" href={`tel:${p.phone_e164}`} className="tabular-nums hover:underline">{prettyPhone(p.phone_e164)}{p.phone_ext ? ` ext. ${p.phone_ext}` : ""}</a>],
    ["Contact", [[p.contact_first_name, p.contact_last_name].filter(Boolean).join(" "), p.contact_title].filter(Boolean).join(", ") || "—"],
    ["Email", p.email ? <a key="e" href={`mailto:${p.email}`} className="break-all hover:underline">{p.email}</a> : "—"],
    ["Category", p.category ?? "—"], ["Locations", p.locations ?? "—"],
    ...(p.rating != null ? [["Google rating", `${p.rating.toFixed(1)} ★${p.review_count != null ? ` (${p.review_count} reviews)` : ""}`] as [string, React.ReactNode]] : []),
    ...(p.source === "places" ? [["Found on", "Google Maps"] as [string, React.ReactNode]] : []),
    ["Address", <span key="a" className="whitespace-pre-line">{[[p.address, p.address2].filter(Boolean).join(", "), [p.city, [p.state, p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "), p.country].filter(Boolean).join("\n") || "—"}</span>],
    ["Tags", p.tags?.length ? p.tags.join(", ") : "—"],
    ["Website", p.website ? <a key="w" href={/^https?:/i.test(p.website) ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" className="break-all hover:underline">{p.website}</a> : "—"],
    ["Provider", <ProviderBadge key="p" p={p} />],
    ...(p.provider_note ? [["What you know", p.provider_note] as [string, React.ReactNode]] : []),
    ["Number held by", l?.carrier_name ?? "—"],
    ["Line type", l?.line_type ? LINE_TYPES[l.line_type] ?? l.line_type : "—"], ["Caller name", l?.caller_name ?? "—"],
    ["Score", <Score key="s" p={p} />], ["Looked up", l ? <LocalDate key="d" iso={l.looked_up_at} /> : "Not yet"],
  ];
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Status</span>
        {manage && p.status !== "dnc"
          ? <Pick label="Status" size="sm" className="w-44" value={p.status} options={PROSPECT_STATUSES.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => onStatus(v as ProspectStatus)} />
          : <Badge variant={p.status === "dnc" ? "destructive" : "outline"}>{statusLabel(p.status)}</Badge>}
      </div>
      {pr && TALK_TRACKS[pr] && p.status !== "dnc" && (
        <div className="rounded-xl border bg-muted/40 p-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Talk track</p>
          <p className="mt-1">{TALK_TRACKS[pr]}</p>
        </div>
      )}
      {!p.providerByYou && p.confidence === "possible" && possibleWhy(l?.carrier_name ?? null) && (
        <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">{possibleWhy(l?.carrier_name ?? null)}</p>
      )}
      <dl className="divide-y rounded-xl border px-3">
        {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>)}
      </dl>
      {manage ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Notes</p>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who you spoke to, contract end date, next step…" />
          <Button size="sm" variant="outline" disabled={saving || notes === (p.notes ?? "")} onClick={() => start(async () => { const r = await updateProspectNotes(p.id, notes); if (r.error) alert(r.error); router.refresh(); })}>
            {saving ? "Saving…" : "Save notes"}
          </Button>
        </div>
      ) : p.notes && <p className="whitespace-pre-wrap">{p.notes}</p>}
      {p.status === "dnc" && <p className="text-xs text-destructive">Do not contact: no calls, texts or emails to this number.</p>}
    </div>
  );
}
