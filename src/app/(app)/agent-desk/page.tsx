import Link from "next/link";
import {
  ArrowRight, Banknote, CalendarRange, CircleAlert, CircleCheck, ExternalLink, Eye, Headphones, Home, Inbox, Info, Mic, Pencil, PhoneIncoming, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { AvailableNowSwitch, ListingActions } from "@/components/live-agents/desk-controls";
import { myLiveAgent, profileGaps, profileStrength } from "@/lib/live-agents/agent-data";
import { AGENT_STATUS } from "@/lib/live-agents/setup";
import { requireUser } from "@/lib/data";

export const metadata = { title: "Agent Desk · Redial Live Agents" };

// Agent Desk: a Live Agent's home. Status of the listing, what's missing,
// Available now, and (as later steps ship) offers, calls and earnings.
export default async function AgentDeskPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  await requireUser();
  const [agent, { sent }] = await Promise.all([myLiveAgent(), searchParams]);

  if (!agent) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-medium text-muted-foreground">Redial Live Agents</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Get paid to answer business calls, on your schedule.</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Build your profile in about 15 minutes: a photo, your experience, skills, three short voice clips, and your rates and hours. The Redial team reviews it, then businesses can find and book you.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="lg" nativeButton={false} render={<Link href="/agent-desk/setup/1" />}>Build my profile <ArrowRight /></Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/become-a-live-agent" />}>How it works</Button>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Banknote, t: "Set your rates", d: "Per minute, per hour or monthly." },
            { icon: CalendarRange, t: "Choose your hours", d: "Go Available now any time." },
            { icon: Home, t: "Work from home", d: "Answer in your browser or the Redial app." },
            { icon: Sparkles, t: "AI on your side", d: "Redial answers first and briefs you." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border p-4"><Icon className="size-5" /><p className="mt-3 font-medium">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div>
          ))}
        </div>
      </div>
    );
  }

  const status = AGENT_STATUS[agent.status];
  const gaps = profileGaps(agent);
  const strength = profileStrength(agent);
  const pendingClips = Object.values(agent.clipStatus).filter((s) => s === "pending").length;
  const first = agent.displayName.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <AgentAvatar name={agent.displayName} url={agent.avatarUrl} online={agent.availableNow && agent.status === "live"} />
          <div>
            <p className="text-sm text-muted-foreground">Agent Desk</p>
            <h1 className="text-2xl font-semibold tracking-tight">Hi, {first}</h1>
          </div>
        </div>
        <AvailableNowSwitch on={agent.availableNow} status={agent.status} />
      </div>

      {sent && agent.status === "pending" && (
        <p className="mt-6 flex gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm"><CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> Sent! The Redial team will review your profile, usually within one business day. We&apos;ll let you know.</p>
      )}
      {agent.status === "draft" && agent.reviewNote && (
        <p className="mt-6 flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><Info className="mt-0.5 size-4 shrink-0" /><span><span className="font-medium">The Redial team asked for a few changes:</span> {agent.reviewNote}</span></p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Your profile</h2>
              <Badge variant={status.tone}>{status.label}</Badge>
              {pendingClips > 0 && agent.status === "live" && <Badge variant="secondary">{pendingClips} clip{pendingClips === 1 ? "" : "s"} in review</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{status.detail}</p>
            <p className="mt-3 text-sm"><span className="font-medium">{agent.displayName}</span> · {agent.headline}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {agent.status === "draft" && <Button nativeButton={false} render={<Link href={`/agent-desk/setup/${agent.setupStep}`} />}>{agent.setupStep >= 7 ? "Review and send" : "Continue setup"} <ArrowRight /></Button>}
              {agent.status !== "suspended" && <Button variant="outline" nativeButton={false} render={<Link href="/agent-desk/setup/1" />}><Pencil /> Edit profile</Button>}
              <Button variant="outline" nativeButton={false} render={<Link href="/agent-desk/preview" />}><Eye /> Preview</Button>
              {agent.status === "live" && <Button variant="outline" nativeButton={false} render={<Link href={`/live-agents/${agent.handle}`} />}><ExternalLink /> Public profile</Button>}
            </div>
            <div className="mt-4 border-t pt-4"><ListingActions status={agent.status} /></div>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">Coming to your Agent Desk</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Inbox, t: "Messages and offers", d: "Businesses message you, send offers and book trials. Accept, counter or decline here." },
                { icon: PhoneIncoming, t: "Incoming transfers", d: "Answer calls in your browser, with the caller's details, the business's script and live AI suggestions." },
                { icon: CalendarRange, t: "Shifts calendar", d: "Your booked shifts and monthly clients in one place." },
                { icon: Banknote, t: "Earnings and payouts", d: "Weekly payouts by direct deposit through Stripe, and your tax documents." },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="rounded-2xl border border-dashed p-4"><Icon className="size-5 text-muted-foreground" /><p className="mt-3 font-medium">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="flex items-center justify-between text-sm"><span className="font-medium">Profile strength</span><span className="text-muted-foreground">{strength}%</span></div>
            <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${strength}%` }} /></div>
            {gaps.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm">
                {gaps.map((g) => (
                  <li key={g.label} className="flex gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" /><Link href={`/agent-desk/setup/${g.step}`} className="underline-offset-2 hover:underline">{g.label}</Link></li>
                ))}
              </ul>
            ) : <p className="mt-3 flex gap-2 text-sm text-muted-foreground"><CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> Everything businesses look for is there.</p>}
          </div>
          <div className="rounded-2xl border p-4 text-sm">
            <p className="font-medium">Tips for getting booked</p>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              <li className="flex gap-2"><Mic className="mt-0.5 size-4 shrink-0" /> Three voice clips: a greeting, a transfer, and something that shows your range.</li>
              <li className="flex gap-2"><Headphones className="mt-0.5 size-4 shrink-0" /> Turn on Available now when you can take calls right away.</li>
              <li className="flex gap-2"><CalendarRange className="mt-0.5 size-4 shrink-0" /> Keep your weekly hours current.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
