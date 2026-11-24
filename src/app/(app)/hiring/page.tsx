import Link from "next/link";
import { ArrowRight, Headset, MessagesSquare, Search } from "lucide-react";
import { AgentTabs } from "@/components/live-agents/agent-tabs";
import { HiringList } from "@/components/live-agents/hiring-list";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data";
import { listThreads, myEngagements } from "@/lib/live-agents/messages";

export const metadata = { title: "Hiring · Redial Live Agents" };

// The business side of Live Agents: booked work, open offers, conversations
// and past work, in the shared list layout.
export default async function HiringPage() {
  await requireUser();
  const [all, threads] = await Promise.all([myEngagements(), listThreads()]);
  const mine = all.filter((e) => e.side === "business");
  const convos = (threads ?? []).filter((t) => t.side === "business");

  return (
    <div className="w-full space-y-6 py-6 px-4 sm:px-6 lg:px-8 2xl:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-md:sr-only">
          <p className="text-sm text-muted-foreground">Redial Live Agents</p>
          <h1 className="text-2xl font-semibold tracking-tight">My Live Agents</h1>
          <p className="text-sm text-muted-foreground">Real people your Redial AI hands calls to. Message, send offers and keep track of booked work.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/messages" />}><MessagesSquare /> Messages</Button>
          <Button nativeButton={false} render={<Link href="/agents" />}><Search /> Find Live Agents</Button>
        </div>
      </div>
      <AgentTabs />

      {mine.length === 0 && convos.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Headset className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No Live Agents yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Browse vetted people, hear their voices, then message them and send an offer: on-demand, a shift, a monthly plan or a paid trial.</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/agents" />}>Browse Live Agents <ArrowRight /></Button>
        </div>
      ) : (
        <HiringList engagements={mine} threads={convos} />
      )}
    </div>
  );
}
