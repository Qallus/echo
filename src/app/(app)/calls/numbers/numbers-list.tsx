"use client";

import { useRouter } from "next/navigation";
import { ArrowRightLeft, Phone } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { Badge } from "@/components/ui/badge";
import { prettyNumber } from "@/components/redial/phone-center";

export type NumberRow = {
  id: string; kind: "line" | "port"; number: string; label: string; mode: string | null; forwardTo: string | null;
  paused: boolean; owner: boolean; assistant: string | null; status: string;
};

const MODE: Record<string, string> = {
  spam: "Screens spam, rings you", unknown: "Screens unknown callers", all: "Screens every caller", off: "Rings straight through",
};
const where = (r: NumberRow) => r.kind === "port" ? "Arriving soon" : [MODE[r.mode ?? ""] ?? "Custom", r.forwardTo ? `to ${prettyNumber(r.forwardTo)}` : null].filter(Boolean).join(" ");

export function NumbersList({ rows }: { rows: NumberRow[] }) {
  const router = useRouter();
  return (
    <CollectionView<NumberRow>
      items={rows} getId={(r) => r.id} title={(r) => prettyNumber(r.number)} noun={["number", "numbers"]} storageKey="phone-numbers" defaultView="list"
      empty="No numbers yet. Add a number or connect the one you have."
      subtitle={(r) => `${r.label} · ${where(r)}`}
      media={(r) => <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">{r.kind === "port" ? <ArrowRightLeft className="size-4" /> : <Phone className="size-4" />}</span>}
      badge={(r) => <Badge variant="outline" className="capitalize">{r.status}</Badge>}
      meta={(r) => (r.owner ? "Yours" : "Shared with you")}
      searchText={(r) => `${r.number} ${r.label} ${r.assistant ?? ""}`}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "lines", label: "Active numbers", test: (r) => r.kind === "line" },
        { id: "ports", label: "Moving to Redial", test: (r) => r.kind === "port" },
      ]}
      columns={[
        { id: "number", label: "Number", sort: (r) => r.number, cell: (r) => <span className="font-medium tabular-nums">{prettyNumber(r.number)}</span> },
        { id: "name", label: "Name", sort: (r) => r.label.toLowerCase(), cell: (r) => r.label },
        { id: "where", label: "Where calls go", cell: (r) => <span className="text-muted-foreground">{where(r)}</span> },
        { id: "assistant", label: "Assistant", cell: (r) => <span className="text-muted-foreground">{r.assistant ?? "—"}</span> },
        { id: "status", label: "Status", sort: (r) => r.status, cell: (r) => <span className="capitalize">{r.status}</span> },
      ]}
      onOpen={(r) => router.push(r.kind === "port" ? "/calls/port" : "/calls?tab=rules")}
    />
  );
}
