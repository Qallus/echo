"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, ArchiveRestore, ArrowDownUp, Ban, Bell, CalendarDays, Check, LayoutGrid, List, Map as MapIcon, Mail, MessageSquareText, MoreHorizontal,
  Pencil, Search, ShieldCheck, Table2, Trash2, UserRound, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { bulkLiveAgents, deleteLiveAgents } from "@/lib/admin/actions/live-agents";
import { ADMIN_STATUS, type AdminAgent } from "@/lib/live-agents/admin-types";
import { cn } from "@/lib/utils";
import { ViewSwitcher } from "@/components/admin/crm/crm-kit";
import { QuickActionBar } from "@/components/collection/quick-action-bar";
import { AgentPanel, ComposePanel, EditPanel, type ComposeMode } from "./agent-panels";
import { CalendarView, CardsView, ListView, MapView, SORT_LABELS, TableView, type Sort, type SortKey } from "./agent-views";

// Admin → Live Agents: every agent in a list, table, cards, map or calendar.
// Tick agents to get the quick-action bar at the bottom of the screen.

const VIEWS = [
  { id: "list", label: "List", icon: List },
  { id: "table", label: "Table", icon: Table2 },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
] as const;
type View = (typeof VIEWS)[number]["id"];
const FILTERS = ["all", "pending", "live", "draft", "paused", "suspended", "archived"] as const;
type Filter = (typeof FILTERS)[number];
const STATUS_ORDER = ["pending", "live", "draft", "paused", "suspended", "archived"];
const VIEW_KEY = "redial.admin.live-agents.view";

// The chosen view, remembered in this browser.
function readView(): View {
  try { const v = localStorage.getItem(VIEW_KEY); if (VIEWS.some((x) => x.id === v)) return v as View; } catch {}
  return "table";
}
function subscribeView(fn: () => void) {
  window.addEventListener(VIEW_KEY, fn);
  window.addEventListener("storage", fn);
  return () => { window.removeEventListener(VIEW_KEY, fn); window.removeEventListener("storage", fn); };
}

const rateOf = (a: AdminAgent) => a.hourlyCents ?? (a.perMinuteCents != null ? a.perMinuteCents * 60 : null);
function sortValue(a: AdminAgent, key: SortKey): string | number | null {
  switch (key) {
    case "name": return a.name.toLowerCase();
    case "status": return STATUS_ORDER.indexOf(a.status);
    case "location": return `${a.region} ${a.city}`.toLowerCase();
    case "rate": return rateOf(a);
    case "rating": return a.rating;
    case "jobs": return a.engagementCount;
    case "updated": return a.updatedAt;
    case "created": return a.createdAt;
  }
}

export function AgentsManager({ agents, skills, canManage }: { agents: AdminAgent[]; skills: { slug: string; label: string }[]; canManage: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [showDemo, setShowDemo] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "status", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [compose, setCompose] = useState<{ ids: string[]; mode: ComposeMode } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const [pending, start] = useTransition();

  // Remember the view in this browser.
  const view = useSyncExternalStore(subscribeView, readView, () => "table" as View);
  const pickView = (v: View) => { try { localStorage.setItem(VIEW_KEY, v); } catch {} window.dispatchEvent(new Event(VIEW_KEY)); };

  const counts = useMemo(() => {
    const pool = agents.filter((a) => showDemo || !a.isDemo);
    return Object.fromEntries(FILTERS.map((f) => [f, f === "all" ? pool.filter((a) => a.status !== "archived").length : pool.filter((a) => a.status === f).length])) as Record<Filter, number>;
  }, [agents, showDemo]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = agents.filter((a) =>
      (showDemo || !a.isDemo)
      && (filter === "all" ? a.status !== "archived" : a.status === filter)
      && words.every((w) => [a.name, a.email, a.phone, a.handle, a.city, a.region, a.headline, ...a.languages].some((x) => x?.toLowerCase().includes(w))));
    return out.sort((x, y) => {
      const a = sortValue(x, sort.key), b = sortValue(y, sort.key);
      const cmp = a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
      return (sort.dir === "asc" ? cmp : -cmp) || x.name.localeCompare(y.name);
    });
  }, [agents, filter, showDemo, q, sort]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShown = shown.length > 0 && shown.every((a) => selected.has(a.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); shown.forEach((a) => (allShown ? n.delete(a.id) : n.add(a.id))); return n; });
  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "rating" || key === "jobs" || key === "updated" || key === "created" ? "desc" : "asc" }));

  const picked = agents.filter((a) => selected.has(a.id));
  const ids = picked.map((a) => a.id);
  const one = picked.length === 1 ? picked[0] : null;
  const skillLabel = (s: string) => skills.find((k) => k.slug === s)?.label ?? s;

  const run = (fn: () => Promise<{ ok?: string; error?: string }>, clear = true) => start(async () => {
    const r = await fn();
    setNotice(r.error ? { text: r.error, error: true } : { text: r.ok ?? "Done." });
    if (!r.error && clear) setSelected(new Set());
    router.refresh();
    setTimeout(() => setNotice(undefined), 8000);
  });
  const who = (n: number) => `${n} ${n === 1 ? "agent" : "agents"}`;
  const act = {
    approve: () => run(() => bulkLiveAgents(ids, "approve")),
    archive: () => confirm(`Archive ${who(ids.length)}? They're hidden from businesses and can't edit their profile. You can restore them from the Archived filter.`) && run(() => bulkLiveAgents(ids, "archive")),
    unarchive: () => run(() => bulkLiveAgents(ids, "unarchive")),
    block: () => {
      const note = prompt(`Block ${who(ids.length)}? Their profile is hidden and locked. Optional: a reason (only staff and the agent see it).`, "");
      if (note !== null) run(() => bulkLiveAgents(ids, "suspend", note));
    },
    unblock: () => run(() => bulkLiveAgents(ids, "restore")),
    remove: () => confirm(`Delete ${who(ids.length)} for good? Their profile, voice clips and conversations are removed and can't be brought back. Their Redial account stays. Agents with paid work can only be archived.`) && run(() => deleteLiveAgents(ids)),
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, city…" className="pl-8" aria-label="Search Live Agents" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}><ArrowDownUp /> {SORT_LABELS[sort.key]}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuRadioGroup value={sort.key} onValueChange={(v) => onSort(v as SortKey)}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <DropdownMenuRadioItem key={k} value={k}>{SORT_LABELS[k]}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={sort.dir} onValueChange={(v) => setSort((s) => ({ ...s, dir: v as Sort["dir"] }))}>
              <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <ViewSwitcher views={[...VIEWS]} value={view} onChange={pickView} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={cn("rounded-full border px-3 py-1 text-sm transition-colors", filter === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {f === "all" ? "All" : ADMIN_STATUS[f].label} <span className="opacity-70">{counts[f]}</span>
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showDemo} onCheckedChange={setShowDemo} /> Demo profiles
        </label>
      </div>

      {view !== "table" && shown.length > 0 && (
        <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={allShown} indeterminate={!allShown && shown.some((a) => selected.has(a.id))} onCheckedChange={toggleAll} /> Select all {shown.length}
        </label>
      )}

      {notice && picked.length === 0 && <p role="status" className={cn("rounded-lg border px-3 py-2 text-sm", notice.error ? "border-destructive/40 text-destructive" : "text-muted-foreground")}>{notice.text}</p>}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{q ? "No agents match that search." : "No agents here yet."}</p>
      ) : view === "list" ? <ListView agents={shown} selected={selected} toggle={toggle} open={setOpenId} />
        : view === "table" ? <TableView agents={shown} selected={selected} toggle={toggle} open={setOpenId} sort={sort} onSort={onSort} onToggleAll={toggleAll} />
        : view === "cards" ? <CardsView agents={shown} selected={selected} toggle={toggle} open={setOpenId} />
        : view === "map" ? <MapView agents={shown} selected={selected} toggle={toggle} open={setOpenId} hover={hover} setHover={setHover} />
        : <CalendarView agents={shown} selected={selected} toggle={toggle} open={setOpenId} />}

      {/* Quick actions, fixed to the bottom while agents are selected */}
      <QuickActionBar count={picked.length} total={shown.length} onSelectAll={toggleAll} onClear={() => setSelected(new Set())} message={picked.length ? notice : null}>
              <Button size="sm" variant="outline" disabled={!one} title={one ? undefined : "Select one agent"} onClick={() => one && setOpenId(one.id)}><UserRound /> Contact</Button>
              {canManage && <Button size="sm" variant="outline" disabled={!one} title={one ? undefined : "Select one agent"} onClick={() => one && setEditId(one.id)}><Pencil /> Edit</Button>}
              {canManage && <Button size="sm" variant="outline" disabled={pending} onClick={() => setCompose({ ids, mode: "message" })}><Bell /> Message</Button>}
              {canManage && <Button size="sm" variant="outline" disabled={pending} onClick={() => setCompose({ ids, mode: "email" })}><Mail /> Email</Button>}
              {canManage && <Button size="sm" variant="outline" disabled={pending} onClick={() => setCompose({ ids, mode: "sms" })}><MessageSquareText /> SMS</Button>}
              {canManage && picked.some((a) => a.status === "pending") && <Button size="sm" disabled={pending} onClick={act.approve}><Check /> Approve</Button>}
              {canManage && (picked.every((a) => a.status === "archived")
                ? <Button size="sm" variant="outline" disabled={pending} onClick={act.unarchive}><ArchiveRestore /> Restore</Button>
                : <Button size="sm" variant="outline" disabled={pending} onClick={act.archive}><Archive /> Archive</Button>)}
              {canManage && (picked.every((a) => a.status === "suspended")
                ? <Button size="sm" variant="outline" disabled={pending} onClick={act.unblock}><ShieldCheck /> Unblock</Button>
                : <Button size="sm" variant="outline" className="text-destructive" disabled={pending} onClick={act.block}><Ban /> Block</Button>)}
              {canManage && <Button size="sm" variant="destructive" disabled={pending} onClick={act.remove}><Trash2 /> Delete</Button>}
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="More actions" />}><MoreHorizontal /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem disabled={!picked.some((a) => a.status === "archived")} onClick={act.unarchive}><ArchiveRestore /> Restore from archive</DropdownMenuItem>
                    <DropdownMenuItem disabled={!picked.some((a) => a.status === "suspended")} onClick={act.unblock}><ShieldCheck /> Unblock</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSelected(new Set())}><X /> Clear selection</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
      </QuickActionBar>

      <AgentPanel agent={agents.find((a) => a.id === openId) ?? null} skillLabel={skillLabel} canManage={canManage} onClose={() => setOpenId(null)}
        onEdit={(id) => { setOpenId(null); setEditId(id); }} onCompose={(list, mode) => setCompose({ ids: list, mode })} />
      <EditPanel agent={agents.find((a) => a.id === editId) ?? null} onClose={() => setEditId(null)} />
      <ComposePanel target={compose} agents={agents} onClose={() => setCompose(null)} />
    </div>
  );
}
