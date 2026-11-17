"use client";

import dynamic from "next/dynamic";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, MapPinOff, Star } from "lucide-react";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ADMIN_STATUS, initials, type AdminAgent } from "@/lib/live-agents/admin-types";
import { money, tzLabel, WEEKDAYS } from "@/lib/live-agents/types";
import { cn } from "@/lib/utils";

// The five ways to look at Live Agents in the admin. Every view shows the
// photo (or initials), lets you tick agents for the quick-action bar, and
// opens the agent's panel when you click them.

const AgentsMap = dynamic(() => import("@/components/live-agents/agents-map").then((m) => m.AgentsMap), {
  ssr: false, loading: () => <div className="h-[60dvh] min-h-80 w-full animate-pulse rounded-xl border bg-muted/40" />,
});

export type SortKey = "name" | "status" | "location" | "rate" | "rating" | "jobs" | "updated" | "created";
export type Sort = { key: SortKey; dir: "asc" | "desc" };
export const SORT_LABELS: Record<SortKey, string> = {
  name: "Name", status: "Status", location: "Location", rate: "Rate", rating: "Rating", jobs: "Jobs", updated: "Last updated", created: "Joined",
};

export type ViewProps = {
  agents: AdminAgent[];
  selected: Set<string>;
  toggle: (id: string) => void;
  open: (id: string) => void;
};

export function StatusBadge({ status }: { status: string }) {
  const s = ADMIN_STATUS[status];
  return <Badge variant={s?.tone ?? "outline"}>{s?.label ?? status}</Badge>;
}

export const rateLabel = (a: AdminAgent) =>
  a.hourlyCents != null ? `${money(a.hourlyCents)}/hr` : a.perMinuteCents != null ? `${money(a.perMinuteCents, { exact: true })}/min` : "—";

function Face({ a, size = "sm" }: { a: AdminAgent; size?: "sm" | "md" | "lg" }) {
  return <AgentAvatar name={a.name} url={a.avatarUrl} online={a.availableNow} size={size} />;
}

function Pick({ a, selected, toggle, className }: { a: AdminAgent; selected: Set<string>; toggle: (id: string) => void; className?: string }) {
  return (
    <span className={cn("flex items-center", className)} onClick={(e) => e.stopPropagation()}>
      <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} aria-label={`Select ${a.name}`} />
    </span>
  );
}

function Demo({ a }: { a: AdminAgent }) {
  return a.isDemo ? <Badge variant="outline" className="text-[10px]">Demo</Badge> : null;
}

function Rating({ a }: { a: AdminAgent }) {
  if (a.rating == null) return <span className="text-muted-foreground">—</span>;
  return <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-amber-400 text-amber-400" />{a.rating.toFixed(1)} <span className="text-muted-foreground">({a.reviewCount})</span></span>;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
export function ListView({ agents, selected, toggle, open }: ViewProps) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {agents.map((a) => (
        <li key={a.id}>
          <div role="button" tabIndex={0} onClick={() => open(a.id)} onKeyDown={(e) => e.key === "Enter" && open(a.id)}
            className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50", selected.has(a.id) && "bg-primary/5")}>
            <Pick a={a} selected={selected} toggle={toggle} />
            <Face a={a} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-medium">{a.name} <Demo a={a} /></p>
              <p className="truncate text-xs text-muted-foreground">{a.headline}</p>
            </div>
            <div className="hidden w-36 truncate text-sm text-muted-foreground md:block">{a.city}, {a.region}</div>
            <div className="hidden w-20 text-sm text-muted-foreground sm:block">{rateLabel(a)}</div>
            <StatusBadge status={a.status} />
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Table (sortable headers, select all)
// ---------------------------------------------------------------------------
function Head({ k, sort, onSort }: { k: SortKey; sort: Sort; onSort: (key: SortKey) => void }) {
  const Icon = sort.key !== k ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="px-3 py-2 font-medium" aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")}>
        {SORT_LABELS[k]} <Icon className={cn("size-3", sort.key !== k && "opacity-40")} />
      </button>
    </th>
  );
}

export function TableView({ agents, selected, toggle, open, sort, onSort, onToggleAll }: ViewProps & {
  sort: Sort; onSort: (key: SortKey) => void; onToggleAll: () => void;
}) {
  const all = agents.length > 0 && agents.every((a) => selected.has(a.id));
  const some = !all && agents.some((a) => selected.has(a.id));
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[56rem] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-2"><Checkbox checked={all} indeterminate={some} onCheckedChange={onToggleAll} aria-label="Select all shown" /></th>
            {(["name", "status", "location", "rate", "rating", "jobs"] as const).map((k) => <Head key={k} k={k} sort={sort} onSort={onSort} />)}
            <th className="px-3 py-2 font-medium">Clips</th><Head k="updated" sort={sort} onSort={onSort} /><Head k="created" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y">
          {agents.map((a) => (
            <tr key={a.id} onClick={() => open(a.id)} className={cn("cursor-pointer hover:bg-muted/50", selected.has(a.id) && "bg-primary/5")}>
              <td className="px-3 py-2"><Pick a={a} selected={selected} toggle={toggle} /></td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Face a={a} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">{a.name} <Demo a={a} /></p>
                    <p className="truncate text-xs text-muted-foreground">{a.email ?? "No account"}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
              <td className="px-3 py-2 text-muted-foreground">{a.city}, {a.region}</td>
              <td className="px-3 py-2 text-muted-foreground">{rateLabel(a)}</td>
              <td className="px-3 py-2"><Rating a={a} /></td>
              <td className="px-3 py-2 text-muted-foreground">{a.engagementCount}</td>
              <td className="px-3 py-2 text-muted-foreground">{a.samples.length}{a.samples.some((s) => s.status === "pending") && <span className="ml-1 text-amber-600">(new)</span>}</td>
              <td className="px-3 py-2 text-muted-foreground">{shortDate(a.updatedAt)}</td>
              <td className="px-3 py-2 text-muted-foreground">{shortDate(a.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
export function CardsView({ agents, selected, toggle, open }: ViewProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6">
      {agents.map((a) => (
        <article key={a.id} role="button" tabIndex={0} onClick={() => open(a.id)} onKeyDown={(e) => e.key === "Enter" && open(a.id)}
          className={cn("relative flex cursor-pointer flex-col gap-3 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md", selected.has(a.id) && "ring-2 ring-primary")}>
          <Pick a={a} selected={selected} toggle={toggle} className="absolute top-3 left-3" />
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <Face a={a} size="md" />
            <div className="min-w-0">
              <p className="flex items-center justify-center gap-1.5 font-semibold">{a.name} <Demo a={a} /></p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{a.headline}</p>
            </div>
            <StatusBadge status={a.status} />
          </div>
          <dl className="mt-auto grid grid-cols-3 gap-1 border-t pt-3 text-center text-xs">
            <div><dt className="text-muted-foreground">Rate</dt><dd className="font-medium">{rateLabel(a)}</dd></div>
            <div><dt className="text-muted-foreground">Rating</dt><dd className="font-medium">{a.rating != null ? a.rating.toFixed(1) : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Jobs</dt><dd className="font-medium">{a.engagementCount}</dd></div>
          </dl>
          <p className="truncate text-center text-xs text-muted-foreground">{a.city}, {a.region}</p>
        </article>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map (approximate spots, ~3 km from home)
// ---------------------------------------------------------------------------
export function MapView({ agents, selected, toggle, open, hover, setHover }: ViewProps & { hover: string | null; setHover: (id: string | null) => void }) {
  const placed = agents.filter((a) => a.lat != null && a.lng != null);
  const unplaced = agents.filter((a) => a.lat == null || a.lng == null);
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_22rem] 2xl:grid-cols-[1fr_26rem]">
      <AgentsMap
        agents={placed.map((a) => ({ id: a.id, handle: a.handle, name: a.name, lat: a.lat!, lng: a.lng!, label: a.name, avatar: a.avatarUrl, initials: initials(a.name) }))}
        active={hover} onHover={setHover} onPick={open}
        className="z-0 h-[65dvh] min-h-96 w-full overflow-hidden rounded-xl border" />
      <div className="max-h-[65dvh] space-y-1 overflow-y-auto rounded-xl border bg-card p-2">
        {agents.map((a) => (
          <div key={a.id} role="button" tabIndex={0} onClick={() => open(a.id)} onKeyDown={(e) => e.key === "Enter" && open(a.id)}
            onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)}
            className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hover:bg-muted/60", hover === a.id && "bg-muted/60", selected.has(a.id) && "bg-primary/5")}>
            <Pick a={a} selected={selected} toggle={toggle} />
            <Face a={a} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {a.lat == null && <MapPinOff className="size-3" />}{a.city}, {a.region}
              </p>
            </div>
            <StatusBadge status={a.status} />
          </div>
        ))}
        {unplaced.length > 0 && <p className="px-2 pt-2 text-[11px] text-muted-foreground">{unplaced.length} without a map spot (no location saved yet).</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar: who works which days, and their hours
// ---------------------------------------------------------------------------
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return m ? `${hr}:${String(m).padStart(2, "0")} ${suffix}` : `${hr} ${suffix}`;
};

export function CalendarView({ agents, selected, toggle, open }: ViewProps) {
  const today = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
  const off = agents.filter((a) => !Object.keys(a.availability ?? {}).length);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {WEEKDAYS.map(({ key, short }) => {
          const on = agents.filter((a) => a.availability?.[key]).sort((x, y) => x.availability[key][0].localeCompare(y.availability[key][0]));
          return (
            <section key={key} className={cn("flex min-h-40 flex-col rounded-xl border bg-card", key === today && "ring-2 ring-primary/50")}>
              <header className="flex items-center justify-between border-b px-3 py-2 text-sm">
                <span className="font-semibold">{short}{key === today && <span className="ml-1.5 text-xs font-normal text-primary">Today</span>}</span>
                <span className="text-xs text-muted-foreground">{on.length}</span>
              </header>
              <div className="flex-1 space-y-1 p-1.5">
                {on.length === 0 && <p className="p-2 text-xs text-muted-foreground">No one scheduled.</p>}
                {on.map((a) => (
                  <div key={a.id} role="button" tabIndex={0} onClick={() => open(a.id)} onKeyDown={(e) => e.key === "Enter" && open(a.id)}
                    className={cn("flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-muted/60", selected.has(a.id) && "bg-primary/5")}
                    title={tzLabel(a.timeZone)}>
                    <Pick a={a} selected={selected} toggle={toggle} />
                    <Face a={a} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{a.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{clock(a.availability[key][0])}–{clock(a.availability[key][1])}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Hours are in each agent&apos;s own time zone (hover a name to see it). A green dot means they&apos;re taking calls right now.
        {off.length > 0 && ` ${off.length} ${off.length === 1 ? "agent hasn't" : "agents haven't"} set hours yet.`}</p>
    </div>
  );
}
