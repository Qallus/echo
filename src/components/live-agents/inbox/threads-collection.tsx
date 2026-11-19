"use client";

import { useRouter } from "next/navigation";
import { Ban, ExternalLink, MailOpen } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { blockLiveAgentThread, markLiveAgentThreadRead } from "@/lib/live-agents/message-actions";
import type { ThreadSummary } from "@/lib/live-agents/messages";
import { cn } from "@/lib/utils";

// Every conversation in the shared list layout. Opening one still goes to
// /messages/[id]; mark read and block and close work on several at once.

const facts = (t: ThreadSummary) => [
  t.side === "agent" ? "You're the Live Agent" : null,
  t.openOffers ? `${t.openOffers} open offer${t.openOffers === 1 ? "" : "s"}` : null,
  t.booked ? `${t.booked} booked` : null,
  t.blocked ? "Closed" : null,
].filter(Boolean).join(" · ");

export function ThreadsCollection({ threads }: { threads: ThreadSummary[] }) {
  const router = useRouter();
  const each = async (rows: ThreadSummary[], fn: (id: string) => Promise<unknown>) => {
    for (const t of rows) await fn(t.id);
    router.refresh();
  };
  return (
    <CollectionView<ThreadSummary>
      items={threads} getId={(t) => t.id} noun={["conversation", "conversations"]} storageKey="messages" defaultView="list"
      empty="No conversations yet. Find a Live Agent to message from Live Agents."
      title={(t) => t.title}
      subtitle={(t) => [t.preview, facts(t)].filter(Boolean).join(" · ")}
      media={(t) => <AgentAvatar name={t.title} url={t.avatarUrl} online={false} />}
      badge={(t) => (
        <span className="flex items-center gap-1">
          {t.unread && <Badge variant="success">New</Badge>}
          {t.openOffers > 0 && <Badge variant="secondary">{t.openOffers} offer{t.openOffers === 1 ? "" : "s"}</Badge>}
          {t.blocked && <Badge variant="outline">Closed</Badge>}
        </span>
      )}
      meta={(t) => <LocalDate iso={t.lastMessageAt} short />}
      searchText={(t) => [t.title, t.subtitle, t.handle, t.preview].filter(Boolean).join(" ")}
      filters={[
        { id: "all", label: "All", test: (t) => !t.blocked },
        { id: "unread", label: "Unread", test: (t) => t.unread },
        { id: "offers", label: "Open offers", test: (t) => t.openOffers > 0 },
        { id: "booked", label: "Booked", test: (t) => t.booked > 0 },
        { id: "hiring", label: "I'm hiring", test: (t) => t.side === "business" },
        { id: "working", label: "I'm the Live Agent", test: (t) => t.side === "agent" },
        { id: "closed", label: "Closed", test: (t) => t.blocked },
      ]}
      date={(t) => t.lastMessageAt}
      columns={[
        { id: "who", label: "Conversation", sort: (t) => t.title.toLowerCase(), cell: (t) => (
          <span className="flex items-center gap-2.5">
            <AgentAvatar name={t.title} url={t.avatarUrl} online={false} size="sm" />
            <span className="min-w-0"><span className={cn("block truncate", t.unread ? "font-semibold" : "font-medium")}>{t.title}</span><span className="block truncate text-xs text-muted-foreground">{t.preview}</span></span>
          </span>
        ) },
        { id: "role", label: "You are", sort: (t) => t.side, cell: (t) => <span className="text-muted-foreground">{t.side === "agent" ? "Live Agent" : "Hiring"}</span> },
        { id: "offers", label: "Open offers", sort: (t) => t.openOffers, cell: (t) => <span className="text-muted-foreground tabular-nums">{t.openOffers || "—"}</span> },
        { id: "booked", label: "Booked", sort: (t) => t.booked, cell: (t) => <span className="text-muted-foreground tabular-nums">{t.booked || "—"}</span> },
        { id: "last", label: "Last message", sort: (t) => t.lastMessageAt, cell: (t) => <span className="text-muted-foreground"><LocalDate iso={t.lastMessageAt} short /></span> },
      ]}
      actions={[
        { label: "Open", icon: ExternalLink, single: true, run: ([t]) => router.push(`/messages/${t.id}`) },
        { label: "Mark read", icon: MailOpen, show: (rows) => rows.some((t) => t.unread), run: (rows) => each(rows.filter((t) => t.unread), markLiveAgentThreadRead) },
        { label: "Block and close", icon: Ban, destructive: true, show: (rows) => rows.some((t) => !t.blocked), run: (rows) => {
          const list = rows.filter((t) => !t.blocked);
          if (!confirm(`Block and close ${list.length === 1 ? `the conversation with ${list[0].title}` : `${list.length} conversations`}? No more messages or offers can be sent in ${list.length === 1 ? "it" : "them"}.`)) return;
          return each(list, blockLiveAgentThread);
        } },
      ]}
      onOpen={(t) => router.push(`/messages/${t.id}`)}
    />
  );
}
