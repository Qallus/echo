"use client";

import { useRouter } from "next/navigation";
import { Download, Phone, UserRound } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { downloadCsv } from "@/components/admin/list-csv";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { RemoveLine, RoutingSwitch } from "./line-forms";

// One Redial line with its usage text and conference flag worked out on the server.
export type LineRow = {
  id: string; owner_id: string; owner_email: string; owner_name: string | null; label: string; number: string; has_destination: boolean;
  mode: string; paused: boolean; calls_30d: number; last_call_at: string | null; usage: string | null; conference: boolean;
};

const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const state = (r: LineRow) => (r.paused ? "Paused" : r.mode === "off" ? "Not screening" : r.mode === "all" ? "Screening all" : "Screening unknown");
const icon = () => <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Phone className="size-4" /></span>;
const badge = (r: LineRow) => <Badge variant="outline" className={r.paused || r.mode === "off" ? "text-muted-foreground" : ""}>{state(r)}</Badge>;

// Admin → Redial → Lines, in the shared list layout. Staff see counts only,
// never what callers said. Conference and Remove need users.manage.
export function LinesList({ rows, manage, aiReady }: { rows: LineRow[]; manage: boolean; aiReady: boolean }) {
  const router = useRouter();
  return (
    <CollectionView<LineRow>
      items={rows} getId={(r) => r.id} title={(r) => `${pretty(r.number)} · ${r.label}`} subtitle={(r) => `${r.owner_name ? `${r.owner_name} · ` : ""}${r.owner_email}`}
      media={icon} badge={badge} noun={["line", "lines"]} storageKey="admin-redial-lines" defaultView="list" empty="No lines yet."
      meta={(r) => <>{r.calls_30d} calls{!r.has_destination && " · no ring number"}{r.usage && ` · ${r.usage}`}{r.last_call_at && <> · last <LocalDate iso={r.last_call_at} short /></>}</>}
      searchText={(r) => `${r.number} ${pretty(r.number)} ${r.label} ${r.owner_name ?? ""} ${r.owner_email}`}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "screening", label: "Screening", test: (r) => !r.paused && r.mode !== "off" },
        { id: "paused", label: "Paused or off", test: (r) => r.paused || r.mode === "off" },
        { id: "no_ring", label: "No ring number", test: (r) => !r.has_destination },
        { id: "conference", label: "Conference", test: (r) => r.conference },
      ]}
      date={(r) => r.last_call_at}
      columns={[
        { id: "number", label: "Number", sort: (r) => r.number, cell: (r) => <span className="font-medium">{pretty(r.number)}</span> },
        { id: "label", label: "Label", sort: (r) => r.label.toLowerCase(), cell: (r) => <span className="text-muted-foreground">{r.label}</span> },
        { id: "member", label: "Member", sort: (r) => r.owner_name ?? r.owner_email, cell: (r) => <span className="text-muted-foreground">{r.owner_name ?? r.owner_email}</span> },
        { id: "status", label: "Status", sort: state, cell: badge },
        { id: "calls", label: "Calls (30 days)", sort: (r) => Number(r.calls_30d), className: "text-right tabular-nums", cell: (r) => r.calls_30d },
        { id: "usage", label: "Minutes", cell: (r) => <span className="text-muted-foreground">{r.usage ?? "—"}</span> },
        { id: "last", label: "Last call", sort: (r) => r.last_call_at, cell: (r) => <span className="text-muted-foreground">{r.last_call_at ? <LocalDate iso={r.last_call_at} short /> : "—"}</span> },
      ]}
      actions={[
        { label: "Member", icon: UserRound, single: true, run: ([r]) => router.push(`/admin/users/${r.owner_id}`) },
        { label: "Export", icon: Download, run: (list) => downloadCsv("redial-lines.csv", ["Number", "Label", "Member", "Email", "Status", "Ring number", "Calls (30 days)", "Minutes", "Last call"],
          list.map((r) => [r.number, r.label, r.owner_name, r.owner_email, state(r), r.has_destination ? "yes" : "no", r.calls_30d, r.usage, r.last_call_at])) },
      ]}
      previewActions={(r) => manage ? <RemoveLine id={r.id} number={pretty(r.number)} /> : null}
      preview={(r) => (
        <div className="space-y-4 text-sm">
          {manage ? <RoutingSwitch key={r.id} id={r.id} on={r.conference} ready={aiReady} /> : r.conference && <p className="text-xs text-muted-foreground">Conference routing on</p>}
          <dl className="divide-y rounded-xl border px-3">
            {[["Member", `${r.owner_name ? `${r.owner_name} · ` : ""}${r.owner_email}`], ["Label", r.label], ["Status", state(r)], ["Ring number", r.has_destination ? "Set" : "Not set"],
              ["Calls (30 days)", String(r.calls_30d)], ["Minutes", r.usage ?? "—"], ["Last call", r.last_call_at ? <LocalDate key="l" iso={r.last_call_at} short /> : "—"]].map(([k, v]) => (
              <div key={String(k)} className="grid grid-cols-[7rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
            ))}
          </dl>
        </div>
      )}
    />
  );
}
