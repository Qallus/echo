import Link from "next/link";
import { ArrowRight, Bot, CalendarClock, MessageSquareText, PhoneIncoming, Sparkles, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentTabs } from "@/components/live-agents/agent-tabs";
import { requireUser } from "@/lib/data";
import { callsBadge } from "@/lib/redial/data";

export const metadata = { title: "AI Agents · Redial" };

const READY = [
  { icon: PhoneIncoming, title: "Your call assistant", what: "Answers your Redial line, screens callers, takes messages and books callbacks. You name it and choose how it greets people.", href: "/calls?tab=assistant", cta: "Set up your assistant", needsLine: true },
  { icon: Workflow, title: "Call Tree", what: "Menus, greetings and rules for where each call goes, with AI steps that look up contacts or send a text.", href: "/call-tree", cta: "Open Call Tree" },
  { icon: Sparkles, title: "Ask Echo", what: "Ask about any call or meeting, or what Redial can do, and get answers with links.", href: "/ask", cta: "Ask Echo" },
];
const SOON = [
  { icon: MessageSquareText, title: "Texting agent", what: "Replies to texts on your line, answers common questions and hands off to you." },
  { icon: CalendarClock, title: "Booking agent", what: "Finds a time with callers and puts it on your calendar." },
  { icon: Bot, title: "Follow-up agent", what: "After a call, sends the summary and next steps, and reminds you of action items." },
];

export default async function AiAgentsPage() {
  await requireUser();
  const line = (await callsBadge()) !== null;
  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="max-md:sr-only">
        <h1 className="text-2xl font-semibold tracking-tight">AI Agents</h1>
        <p className="text-sm text-muted-foreground">AI that works your phones with you: answering, routing and following up.</p>
      </div>
      <AgentTabs />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {READY.map(({ icon: Icon, title, what, href, cta, needsLine }) => (
          <div key={title} className="flex flex-col rounded-2xl border bg-card p-4">
            <Icon className="size-5 text-muted-foreground" />
            <h2 className="mt-2 font-semibold">{title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{what}</p>
            {needsLine && !line ? (
              <Button className="mt-4 w-fit" variant="outline" nativeButton={false} render={<Link href="/setup" />}>Set up Redial first <ArrowRight /></Button>
            ) : (
              <Button className="mt-4 w-fit" variant="outline" nativeButton={false} render={<Link href={href} />}>{cta} <ArrowRight /></Button>
            )}
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Coming next</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOON.map(({ icon: Icon, title, what }) => (
            <div key={title} className="rounded-2xl border border-dashed p-4">
              <div className="flex items-center justify-between"><Icon className="size-5 text-muted-foreground" /><Badge variant="outline">Soon</Badge></div>
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{what}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
