import Link from "next/link";
import { ArrowRight, Headset, MessagesSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data";
import { listThreads, myEngagements } from "@/lib/live-agents/messages";
import { engagementLabel, offerPrice } from "@/lib/live-agents/types";

export const metadata = { title: "Hiring · Redial Live Agents" };

const date = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" }) : null);

// The business side of Live Agents: who you're talking to, open offers,
// and booked work.
export default async function HiringPage() {
  await requireUser();
  const [all, threads] = await Promise.all([myEngagements(), listThreads()]);
  const mine = all.filter((e) => e.side === "business");
  const booked = mine.filter((e) => e.status === "accepted" || e.status === "active");
  const open = mine.filter((e) => e.status === "offered");
  const past = mine.filter((e) => ["completed", "cancelled", "declined", "withdrawn"].includes(e.status)).slice(0, 20);
  const convos = (threads ?? []).filter((t) => t.side === "business");

  const row = (e: (typeof mine)[number]) => {
    const p = offerPrice(e);
    return (
      <li key={e.id}>
        <Link href={`/messages/${e.threadId}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{e.counterpart} · {engagementLabel(e.type)}</p>
            <p className="text-sm text-muted-foreground">{[date(e.startsOn), e.schedule, `${p.businessTotal ?? p.businessRate}${e.type === "retainer" ? "/mo" : ""} incl. fee`].filter(Boolean).join(" · ")}</p>
          </div>
          <Badge variant={e.status === "offered" ? "secondary" : e.status === "accepted" || e.status === "active" ? "success" : "outline"}>
            {e.status === "offered" ? (e.offeredBy === "business" ? "Waiting for them" : "Counter-offer for you") : e.status === "accepted" ? "Booked" : e.status[0].toUpperCase() + e.status.slice(1)}
          </Badge>
        </Link>
      </li>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Redial Live Agents</p>
          <h1 className="text-2xl font-semibold tracking-tight">Hiring</h1>
          <p className="text-sm text-muted-foreground">Real people your Redial AI hands calls to. Message, send offers and keep track of booked work.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/messages" />}><MessagesSquare /> Messages</Button>
          <Button nativeButton={false} render={<Link href="/live-agents" />}><Search /> Find Live Agents</Button>
        </div>
      </div>

      {mine.length === 0 && convos.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Headset className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No Live Agents yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Browse vetted people, hear their voices, then message them and send an offer: on-demand, a shift, a monthly plan or a paid trial.</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/live-agents" />}>Browse Live Agents <ArrowRight /></Button>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">Booked</h2>
            {booked.length ? <ul className="divide-y rounded-2xl border">{booked.map(row)}</ul> : <p className="text-sm text-muted-foreground">Nothing booked yet.</p>}
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold">Open offers</h2>
            {open.length ? <ul className="divide-y rounded-2xl border">{open.map(row)}</ul> : <p className="text-sm text-muted-foreground">No open offers.</p>}
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold">Conversations</h2>
            {convos.length ? (
              <ul className="divide-y rounded-2xl border">
                {convos.map((t) => (
                  <li key={t.id}>
                    <Link href={`/messages/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className={t.unread ? "font-semibold" : "font-medium"}>{t.title}</p>
                        <p className="truncate text-sm text-muted-foreground">{t.preview}</p>
                      </div>
                      {t.unread && <Badge variant="success">New</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No conversations yet.</p>}
          </section>
          {past.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold">Past</h2>
              <ul className="divide-y rounded-2xl border">{past.map(row)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
