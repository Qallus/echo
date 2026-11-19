"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { ThreadsCollection } from "@/components/live-agents/inbox/threads-collection";
import type { ThreadSummary } from "@/lib/live-agents/messages";
import { cn } from "@/lib/utils";

const when = (iso: string) => {
  const d = new Date(iso), now = new Date();
  return d.toDateString() === now.toDateString() ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

// The inbox. With nothing open, every conversation in the shared list layout
// (views, search, filters, checkboxes). With one open: conversations on the
// left, the open one on the right; on a phone they take turns.
export function InboxShell({ threads, children }: { threads: ThreadSummary[]; children: React.ReactNode }) {
  const path = usePathname();
  const open = path.split("/")[2] ?? null;
  if (!open) {
    return (
      <div className="w-full space-y-4 px-4 py-8 sm:px-6 lg:px-8 2xl:px-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">Live Agents and the businesses they work with. Contact details stay hidden; calls, bookings and payments run through Redial.</p>
        </div>
        {threads.length === 0 ? (
          <div className="space-y-2 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <MessagesSquare className="mx-auto size-6" />
            <p>No conversations yet.</p>
            <p><Link href="/live-agents" className="underline underline-offset-2">Find a Live Agent</Link> to message.</p>
          </div>
        ) : <ThreadsCollection threads={threads} />}
        {children}
      </div>
    );
  }
  return (
    <div className="grid min-h-0 grid-cols-1 md:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className={cn("border-r md:block md:h-dvh md:overflow-y-auto", open && "hidden")}>
        <div className="sticky top-0 z-10 border-b bg-background px-4 py-3">
          <h1 className="text-lg font-semibold">Messages</h1>
          <p className="text-xs text-muted-foreground">Live Agents and the businesses they work with</p>
        </div>
        {threads.length === 0 ? (
          <div className="space-y-2 p-6 text-center text-sm text-muted-foreground">
            <MessagesSquare className="mx-auto size-6" />
            <p>No conversations yet.</p>
            <p><Link href="/live-agents" className="underline underline-offset-2">Find a Live Agent</Link> to message.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/messages/${t.id}`} className={cn("flex gap-3 px-4 py-3 transition hover:bg-muted/40", open === t.id && "bg-muted/60")}>
                  <AgentAvatar name={t.title} url={t.avatarUrl} online={false} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn("truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{t.title}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{when(t.lastMessageAt)}</span>
                    </div>
                    <p className={cn("truncate text-xs", t.unread ? "text-foreground" : "text-muted-foreground")}>{t.preview}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {[t.side === "agent" ? "You're the Live Agent" : null, t.openOffers ? `${t.openOffers} open offer${t.openOffers === 1 ? "" : "s"}` : null, t.booked ? `${t.booked} booked` : null, t.blocked ? "Closed" : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {t.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" aria-label="Unread" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className={cn("min-w-0", !open && "hidden md:block")}>{children}</section>
    </div>
  );
}
