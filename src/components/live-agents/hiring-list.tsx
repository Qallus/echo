"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, ExternalLink, MailOpen, MessagesSquare } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markLiveAgentThreadRead } from "@/lib/live-agents/message-actions";
import type { Engagement, ThreadSummary } from "@/lib/live-agents/messages";
import { engagementLabel, offerPrice } from "@/lib/live-agents/types";
import { cn } from "@/lib/utils";

// The business side of Live Agents in the shared list layout: booked work,
// open offers, conversations and past work in one list with filter chips.
// A click previews the work; "Open conversation" goes to /messages/[id].

export type HiringEngagement = Engagement & { side: string; counterpart: string; handle: string | null };
type Row = { kind: "work"; id: string; e: HiringEngagement } | { kind: "chat"; id: string; t: ThreadSummary };

const PAST = ["completed", "cancelled", "declined", "withdrawn"];
const day = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" }) : null);
const booked = (r: Row) => r.kind === "work" && (r.e.status === "accepted" || r.e.status === "active");
const offered = (r: Row) => r.kind === "work" && r.e.status === "offered";
const past = (r: Row) => r.kind === "work" && PAST.includes(r.e.status);
const threadId = (r: Row) => (r.kind === "work" ? r.e.threadId : r.t.id);
const name = (r: Row) => (r.kind === "work" ? r.e.counterpart : r.t.title);
const price = (e: HiringEngagement) => {
  const p = offerPrice(e);
  return `${p.businessTotal ?? p.businessRate}${e.type === "retainer" ? "/mo" : ""} incl. fee`;
};
const statusText = (e: HiringEngagement) =>
  e.status === "offered" ? (e.offeredBy === "business" ? "Waiting for them" : "Counter-offer for you")
  : e.status === "accepted" ? "Awaiting your payment"
  : e.status === "active" ? "Booked and paid"
  : e.status[0].toUpperCase() + e.status.slice(1);
const status = (r: Row) => r.kind === "work"
  ? <Badge variant={r.e.status === "offered" ? "secondary" : r.e.status === "accepted" || r.e.status === "active" ? "success" : "outline"}>{statusText(r.e)}</Badge>
  : r.t.unread ? <Badge variant="success">New</Badge> : <Badge variant="outline">Conversation</Badge>;

export function HiringList({ engagements, threads }: { engagements: HiringEngagement[]; threads: ThreadSummary[] }) {
  const router = useRouter();
  const rows: Row[] = [
    ...engagements.map((e): Row => ({ kind: "work", id: e.id, e })),
    ...threads.map((t): Row => ({ kind: "chat", id: `t:${t.id}`, t })),
  ];
  const avatar = (r: Row) => r.kind === "chat"
    ? <AgentAvatar name={r.t.title} url={r.t.avatarUrl} online={false} />
    : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><Briefcase className="size-4" /></span>;

  return (
    <CollectionView<Row>
      items={rows} getId={(r) => r.id} noun={["item", "items"]} storageKey="hiring" defaultView="list"
      empty="Nothing here yet."
      title={(r) => (r.kind === "work" ? `${r.e.counterpart} · ${engagementLabel(r.e.type)}` : r.t.title)}
      subtitle={(r) => r.kind === "work" ? [day(r.e.startsOn), r.e.schedule, price(r.e)].filter(Boolean).join(" · ") : r.t.preview}
      media={avatar} badge={status}
      meta={(r) => <LocalDate iso={r.kind === "work" ? r.e.createdAt : r.t.lastMessageAt} short />}
      searchText={(r) => r.kind === "work" ? [r.e.counterpart, r.e.handle, engagementLabel(r.e.type), r.e.schedule, r.e.script, statusText(r.e)].filter(Boolean).join(" ") : [r.t.title, r.t.handle, r.t.preview].filter(Boolean).join(" ")}
      filters={[
        { id: "current", label: "Booked and open", test: (r) => booked(r) || offered(r) },
        { id: "booked", label: "Booked", test: booked },
        { id: "open", label: "Open offers", test: offered },
        { id: "chats", label: "Conversations", test: (r) => r.kind === "chat" },
        { id: "past", label: "Past", test: past },
        { id: "all", label: "All", test: () => true },
      ]}
      date={(r) => (r.kind === "work" ? r.e.startsOn ?? r.e.createdAt : r.t.lastMessageAt)}
      columns={[
        { id: "who", label: "Live Agent", sort: (r) => name(r).toLowerCase(), cell: (r) => <span className="flex items-center gap-2.5">{avatar(r)}<span className={cn("font-medium", r.kind === "chat" && r.t.unread && "font-semibold")}>{name(r)}</span></span> },
        { id: "type", label: "Work", sort: (r) => (r.kind === "work" ? engagementLabel(r.e.type) : null), cell: (r) => <span className="text-muted-foreground">{r.kind === "work" ? engagementLabel(r.e.type) : "—"}</span> },
        { id: "status", label: "Status", sort: (r) => (r.kind === "work" ? statusText(r.e) : r.t.unread ? "New" : "Conversation"), cell: status },
        { id: "starts", label: "Starts", sort: (r) => (r.kind === "work" ? r.e.startsOn : null), cell: (r) => <span className="text-muted-foreground">{r.kind === "work" ? day(r.e.startsOn) ?? "—" : "—"}</span> },
        { id: "price", label: "Price", sort: (r) => (r.kind === "work" ? r.e.rateCents : null), cell: (r) => <span className="text-muted-foreground tabular-nums">{r.kind === "work" ? price(r.e) : "—"}</span> },
        { id: "updated", label: "Updated", sort: (r) => (r.kind === "work" ? r.e.respondedAt ?? r.e.createdAt : r.t.lastMessageAt), cell: (r) => <span className="text-muted-foreground"><LocalDate iso={r.kind === "work" ? r.e.respondedAt ?? r.e.createdAt : r.t.lastMessageAt} short /></span> },
      ]}
      actions={[
        { label: "Open conversation", icon: MessagesSquare, single: true, run: ([r]) => router.push(`/messages/${threadId(r)}`) },
        { label: "Mark read", icon: MailOpen, show: (rs) => rs.some((r) => r.kind === "chat" && r.t.unread), run: async (rs) => {
          for (const r of rs) if (r.kind === "chat" && r.t.unread) await markLiveAgentThreadRead(r.t.id);
          router.refresh();
        } },
      ]}
      previewActions={(r) => <Button size="sm" nativeButton={false} render={<Link href={`/messages/${threadId(r)}`} />}><ExternalLink /> Open conversation</Button>}
      preview={(r) => r.kind === "chat" ? (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3"><AgentAvatar name={r.t.title} url={r.t.avatarUrl} online={false} size="lg" /><div className="min-w-0"><p className="font-medium">{r.t.title}</p><p className="text-muted-foreground">{r.t.subtitle}</p></div></div>
          <p className="rounded-xl border p-3 text-muted-foreground">{r.t.preview || "No messages yet."}</p>
          <p className="text-xs text-muted-foreground">{[r.t.openOffers ? `${r.t.openOffers} open offer${r.t.openOffers === 1 ? "" : "s"}` : null, r.t.booked ? `${r.t.booked} booked` : null, r.t.blocked ? "Closed" : null].filter(Boolean).join(" · ") || "Last message"} · <LocalDate iso={r.t.lastMessageAt} /></p>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div>{status(r)}</div>
          <dl className="divide-y rounded-xl border px-3">
            {([
              ["Live Agent", r.e.counterpart + (r.e.handle ? ` (@${r.e.handle})` : "")],
              ["Work", engagementLabel(r.e.type)],
              ["Price", price(r.e)],
              ["Hours", r.e.hours ? String(r.e.hours) : null],
              ["Starts", day(r.e.startsOn)],
              ["Ends", day(r.e.endsOn)],
              ["Schedule", r.e.schedule],
              ["Offered by", r.e.offeredBy === "business" ? "You" : "The Live Agent"],
            ] as const).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          {r.e.script && <div><p className="mb-1 text-xs font-medium text-muted-foreground">Script and notes</p><p className="whitespace-pre-wrap rounded-xl border p-3">{r.e.script}</p></div>}
          {r.e.status === "accepted" && <p className="text-xs text-muted-foreground">Accepted. Pay from the conversation to book it.</p>}
        </div>
      )}
    />
  );
}
