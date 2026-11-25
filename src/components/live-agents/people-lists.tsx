"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ExternalLink, MessagesSquare, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollectionView } from "@/components/collection/collection-view";
import { IconTile, muted } from "@/components/collection/kit";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import type { HiredAgent, MyClient, Standing } from "@/lib/live-agents/my-agents";

// My Live Agents (business side) and My clients (agent side), in the shared
// list layout: list, table, cards, map and calendar, with Message on every row.

const LABEL: Record<Standing, string> = { working: "Working now", booked: "Booked", offer: "Offer sent", past: "Past work" };
const day = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const tag = (s: Standing) => <Badge variant={s === "working" ? "default" : "outline"}>{LABEL[s]}</Badge>;
const filters = <T extends { standing: Standing }>() => [
  { id: "current", label: "Working and booked", test: (r: T) => r.standing === "working" || r.standing === "booked" },
  { id: "working", label: "Working now", test: (r: T) => r.standing === "working" },
  { id: "offer", label: "Offers", test: (r: T) => r.standing === "offer" },
  { id: "past", label: "Past", test: (r: T) => r.standing === "past" },
  { id: "all", label: "All", test: () => true },
];

export function MyAgentsList({ rows }: { rows: HiredAgent[] }) {
  const router = useRouter();
  return (
    <CollectionView<HiredAgent>
      items={rows} getId={(r) => r.id} title={(r) => r.name} noun={["Live Agent", "Live Agents"]} storageKey="my-live-agents" defaultView="cards"
      subtitle={(r) => r.headline || `${r.work} · ${r.rate}`}
      media={(r) => <AgentAvatar name={r.name} url={r.avatarUrl} online={r.availableNow} size="sm" />}
      badge={(r) => tag(r.standing)}
      meta={(r) => [r.city, r.region].filter(Boolean).join(", ") || r.workspace}
      searchText={(r) => `${r.name} ${r.headline} ${r.skills.join(" ")} ${r.languages.join(" ")} ${r.city} ${r.workspace}`}
      filters={filters<HiredAgent>()}
      location={(r) => (r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null)}
      date={(r) => r.startsOn ?? r.since}
      columns={[
        { id: "name", label: "Live Agent", sort: (r) => r.name.toLowerCase(), cell: (r) => <span className="font-medium">{r.name}</span> },
        { id: "status", label: "Status", sort: (r) => r.standing, cell: (r) => tag(r.standing) },
        { id: "work", label: "Work", cell: (r) => `${r.work} · ${r.rate}` },
        { id: "skills", label: "Skills", cell: (r) => muted(r.skills.slice(0, 3).join(", ")) },
        { id: "rating", label: "Rating", sort: (r) => r.rating ?? 0, cell: (r) => (r.rating ? <span className="inline-flex items-center gap-1"><Star className="size-3.5" /> {r.rating.toFixed(1)}</span> : muted("—")) },
        { id: "for", label: "Workspace", sort: (r) => r.workspace, cell: (r) => muted(r.workspace) },
        { id: "starts", label: "Starts", sort: (r) => r.startsOn ?? "", cell: (r) => muted(day(r.startsOn)) },
        { id: "jobs", label: "Jobs", sort: (r) => r.jobs, cell: (r) => <span className="tabular-nums">{r.jobs}</span> },
      ]}
      actions={[
        { label: "Message", icon: MessagesSquare, single: true, run: ([r]) => router.push(`/messages/${r.threadId}`) },
        { label: "Profile", icon: ExternalLink, single: true, show: (sel) => Boolean(sel[0]?.handle), run: ([r]) => router.push(`/live-agents/${r.handle}`) },
      ]}
      preview={(r) => (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <AgentAvatar name={r.name} url={r.avatarUrl} online={r.availableNow} />
            <div><p className="font-medium">{r.name}</p><p className="text-muted-foreground">{r.headline}</p></div>
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <div><dt className="text-muted-foreground">Status</dt><dd>{LABEL[r.standing]}</dd></div>
            <div><dt className="text-muted-foreground">Work</dt><dd>{r.work} · {r.rate}</dd></div>
            <div><dt className="text-muted-foreground">Starts</dt><dd>{day(r.startsOn)}</dd></div>
            <div><dt className="text-muted-foreground">Workspace</dt><dd>{r.workspace}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Skills</dt><dd>{r.skills.join(", ") || "—"}</dd></div>
          </dl>
        </div>
      )}
      previewActions={(r) => <>
        <Button size="sm" nativeButton={false} render={<Link href={`/messages/${r.threadId}`} />}><MessagesSquare /> Message</Button>
        {r.handle && <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/live-agents/${r.handle}`} />}>Profile</Button>}
      </>}
      empty="No Live Agents yet. Find one in Search Live Agents, message them and send an offer."
      toolbar={<Button variant="outline" nativeButton={false} render={<Link href="/agents" />}>Find Live Agents</Button>}
    />
  );
}

export function MyClientsList({ rows }: { rows: MyClient[] }) {
  const router = useRouter();
  return (
    <CollectionView<MyClient>
      items={rows} getId={(r) => r.id} title={(r) => r.name} noun={["business", "businesses"]} storageKey="agent-clients" defaultView="list"
      subtitle={(r) => `${r.work} · ${r.rate}`}
      media={() => <IconTile icon={Building2} />}
      badge={(r) => tag(r.standing)}
      meta={(r) => `Since ${day(r.since)}`}
      searchText={(r) => `${r.name} ${r.work}`}
      filters={filters<MyClient>()}
      date={(r) => r.startsOn ?? r.since}
      columns={[
        { id: "name", label: "Business", sort: (r) => r.name.toLowerCase(), cell: (r) => <span className="font-medium">{r.name}</span> },
        { id: "status", label: "Status", sort: (r) => r.standing, cell: (r) => tag(r.standing) },
        { id: "work", label: "Work", cell: (r) => `${r.work} · ${r.rate} to you` },
        { id: "starts", label: "Starts", sort: (r) => r.startsOn ?? "", cell: (r) => muted(day(r.startsOn)) },
        { id: "jobs", label: "Jobs", sort: (r) => r.jobs, cell: (r) => <span className="tabular-nums">{r.jobs}</span> },
      ]}
      actions={[{ label: "Message", icon: MessagesSquare, single: true, run: ([r]) => router.push(`/messages/${r.threadId}`) }]}
      onOpen={(r) => router.push(`/messages/${r.threadId}`)}
      empty="No businesses yet. When a business sends you an offer, it shows up here."
    />
  );
}
