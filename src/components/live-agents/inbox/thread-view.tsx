"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, CreditCard, EllipsisVertical, ExternalLink, Flag, Lock, Paperclip, Send, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pick } from "@/components/ui/pick";
import { Textarea } from "@/components/ui/textarea";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { OfferDialog, type AgentRates } from "@/components/live-agents/inbox/offer-form";
import {
  blockLiveAgentThread, markLiveAgentThreadRead, reportLiveAgentThread, respondToLiveAgentOffer, routeLiveAgentCalls, sendLiveAgentMessage,
} from "@/lib/live-agents/message-actions";
import type { Engagement, Thread } from "@/lib/live-agents/messages";
import { disputeEngagement, payForEngagement } from "@/lib/live-agents/payments";
import { engagementLabel, offerPrice, type Fees } from "@/lib/live-agents/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const time = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const date = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : null);

const STATUS: Record<string, { label: string; tone: "outline" | "secondary" | "success" | "destructive" }> = {
  offered: { label: "Waiting for a reply", tone: "secondary" }, accepted: { label: "Accepted · awaiting payment", tone: "secondary" }, active: { label: "Booked and paid", tone: "success" },
  declined: { label: "Declined", tone: "outline" }, withdrawn: { label: "Withdrawn", tone: "outline" }, replaced: { label: "Countered", tone: "outline" },
  completed: { label: "Completed", tone: "outline" }, cancelled: { label: "Cancelled", tone: "destructive" },
};

type LineOption = { id: string; label: string; number: string };

export function ThreadView({ thread: t, rates, fees, lines = [] }: { thread: Thread; rates: AgentRates; fees: Fees; lines?: LineOption[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [offer, setOffer] = useState<{ open: boolean; counter: Engagement | null }>({ open: false, counter: null });
  const [report, setReport] = useState(false);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const engagements = new Map(t.engagements.map((e) => [e.id, e]));

  // New messages arrive live; refresh the server data when one does.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel = supabase.channel(`thread-${t.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_agent_messages", filter: `thread_id=eq.${t.id}` }, () => router.refresh())
        .subscribe();
    });
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [t.id, router]);

  const count = t.messages.length;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
    void markLiveAgentThreadRead(t.id);
  }, [t.id, count]);

  const send = () => start(async () => {
    if (!body.trim()) return;
    setError(undefined);
    const r = await sendLiveAgentMessage(t.id, body);
    if (r.error) return setError(r.error);
    setBody("");
    router.refresh();
  });

  const block = () => start(async () => {
    const r = await blockLiveAgentThread(t.id);
    if (r.error) setError(r.error); else router.refresh();
  });

  return (
    <div className="flex h-[calc(100dvh-var(--bottom-nav,0px))] min-h-0 flex-col md:h-dvh">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Link href="/messages" className="rounded-md p-1 text-muted-foreground hover:text-foreground md:hidden" aria-label="All conversations"><ArrowLeft className="size-5" /></Link>
        <AgentAvatar name={t.title} url={t.avatarUrl} online={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{t.title}</p>
          <p className="truncate text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
        {t.side === "business" && t.handle && <Button size="sm" variant="outline" className="hidden sm:inline-flex" nativeButton={false} render={<Link href={`/live-agents/${t.handle}`} />}><ExternalLink /> Profile</Button>}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label="More" />}><EllipsisVertical /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setReport(true)}><Flag /> Report</DropdownMenuItem>
            {!t.blocked && <DropdownMenuItem className="text-destructive" onClick={block}><Ban /> Block and close</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <p className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" /> Contact details are hidden. Calls and payments run through Redial, so you&apos;re both covered.
      </p>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {t.messages.map((m) => {
          if (m.kind === "system") return <p key={m.id} className="text-center text-xs text-muted-foreground">{m.body} · {time(m.createdAt)}</p>;
          const e = m.engagementId ? engagements.get(m.engagementId) : undefined;
          if (m.kind === "offer" && e) {
            return <OfferCard key={m.id} e={e} side={t.side} mine={m.side === t.side} note={m.body} thread={t.id} blocked={t.blocked} lines={lines}
              onCounter={() => setOffer({ open: true, counter: e })} />;
          }
          return (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] space-y-1 rounded-2xl px-3.5 py-2 text-sm", m.mine ? "bg-foreground text-background" : "bg-muted")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn("text-[11px]", m.mine ? "text-background/60" : "text-muted-foreground")}>{time(m.createdAt)}</p>
                {m.masked && <p className={cn("text-[11px]", m.mine ? "text-background/70" : "text-muted-foreground")}>Redial hid contact details in this message.</p>}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      {t.blocked ? (
        <p className="border-t px-4 py-4 text-center text-sm text-muted-foreground">This conversation is closed.</p>
      ) : (
        <div className="space-y-2 border-t p-3">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex items-end gap-2">
            <Textarea rows={2} value={body} maxLength={4000} placeholder="Write a message…" className="min-h-11 flex-1 resize-none"
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <Button size="icon" disabled={pending || !body.trim()} onClick={send} aria-label="Send"><Send /></Button>
          </div>
          {t.side === "business" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setOffer({ open: true, counter: null })}><Paperclip /> Send an offer</Button>
              <span className="text-xs text-muted-foreground">On-demand, a shift, a monthly plan or a paid trial.</span>
            </div>
          )}
        </div>
      )}

      {offer.open && <OfferDialog open onOpenChange={(o) => setOffer((x) => ({ ...x, open: o }))} thread={t.id} side={t.side} rates={rates} fees={fees} counter={offer.counter} />}
      <ReportDialog open={report} onOpenChange={setReport} thread={t.id} />
    </div>
  );
}

function OfferCard({ e, side, mine, note, thread, blocked, lines, onCounter }: { e: Engagement; side: "business" | "agent"; mine: boolean; note: string; thread: string; blocked: boolean; lines: LineOption[]; onCounter: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [dispute, setDispute] = useState(false);
  const [problem, setProblem] = useState("");
  const [pending, start] = useTransition();
  const price = offerPrice(e);
  const act = (action: "accept" | "decline" | "withdraw" | "cancel" | "complete") => start(async () => {
    setError(undefined);
    const r = await respondToLiveAgentOffer(e.id, action, thread);
    if (r.error) setError(r.error); else router.refresh();
  });
  const st = STATUS[e.status] ?? STATUS.offered;
  const extra = note.includes(" · ") ? note.slice(note.indexOf(" · ") + 3) : "";
  const rows: [string, string | null][] = [
    ["When", [date(e.startsOn), e.endsOn && `to ${date(e.endsOn)}`, e.schedule].filter(Boolean).join(" · ") || null],
    ["Hours", e.type === "shift" ? `${e.hours} hours` : e.type === "retainer" ? `${e.hours} hours a month` : e.type === "trial" ? "30 minutes" : null],
    ["Rate", e.type === "on_demand" ? `${price.rate} (agent's rate)` : e.type === "retainer" ? null : `${price.rate} (agent's rate)`],
    [side === "business" ? "You pay" : "Business pays", `${price.businessTotal ?? price.businessRate}${e.type === "retainer" ? "/mo" : ""} incl. ${e.businessFeePct}% fee`],
    [side === "agent" ? "You receive" : "Agent receives", `${price.agentTotal ?? price.agentRate}${e.type === "retainer" ? "/mo" : ""}`],
  ];
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className="w-full max-w-md space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">{e.replaces ? "Counter-offer" : "Offer"} · {engagementLabel(e.type)}</p>
          <Badge variant={st.tone}>{st.label}</Badge>
        </div>
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {e.script && <p className="rounded-lg bg-muted/50 p-2.5 text-xs whitespace-pre-wrap text-muted-foreground">{e.script}</p>}
        {extra && <p className="text-sm">{extra}</p>}
        {!blocked && e.status === "offered" && (
          <div className="flex flex-wrap gap-2">
            {mine ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act("withdraw")}>Withdraw</Button>
            ) : (
              <>
                <Button size="sm" disabled={pending} onClick={() => act("accept")}>Accept</Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={onCounter}>Counter</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("decline")}>Decline</Button>
              </>
            )}
          </div>
        )}
        {e.status === "accepted" && (
          <div className="space-y-2">
            {side === "business" ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={pending} onClick={() => start(async () => {
                  setError(undefined);
                  const r = await payForEngagement(e.id);
                  if (r.url) window.location.assign(r.url); else setError(r.error);
                })}><CreditCard /> {e.type === "on_demand" ? "Add a card to start" : `Pay ${price.businessTotal} to confirm`}</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("cancel")}>Cancel</Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted-foreground">Waiting for the business to pay. You&apos;ll get a message when it&apos;s confirmed.</p>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("cancel")}>Cancel</Button>
              </div>
            )}
          </div>
        )}
        {e.status === "active" && side === "business" && (
          <div className="space-y-1.5 rounded-lg border p-3">
            <p className="text-xs font-medium">Send missed calls from</p>
            {lines.length ? (
              <Pick label="Redial line" value={e.lineId ?? ""} onChange={(v) => start(async () => {
                setError(undefined);
                const r = await routeLiveAgentCalls(e.id, v || null, thread);
                if (r.error) setError(r.error); else router.refresh();
              })} options={[{ value: "", label: "Don't send calls yet" }, ...lines.map((l) => ({ value: l.id, label: `${l.label} · ${l.number.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}` }))]} />
            ) : <p className="text-xs text-muted-foreground">Set up a Redial line first, then choose it here.</p>}
            <p className="text-xs text-muted-foreground">When nobody on your line answers, the call rings the Live Agent&apos;s Agent Desk{e.type === "shift" || e.type === "trial" ? " on the booked day" : " while they're Available now"}.</p>
          </div>
        )}
        {e.status === "active" && side === "business" && !e.disputedAt && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => act("complete")}>Mark complete</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDispute(true)}><TriangleAlert /> Report a problem</Button>
          </div>
        )}
        {e.status === "completed" && side === "business" && !e.disputedAt && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDispute(true)}><TriangleAlert /> Report a problem (within 72 hours)</Button>
        )}
        {e.disputedAt && <p className="text-xs text-muted-foreground">A problem was reported. The Redial team is reviewing it and the payout is on hold.</p>}
        {dispute && (
          <div className="space-y-2 rounded-lg border p-3">
            <Textarea rows={3} maxLength={2000} value={problem} onChange={(ev) => setProblem(ev.target.value)} placeholder="What went wrong? For example: they didn't answer during the shift." />
            <div className="flex gap-2">
              <Button size="sm" disabled={pending || !problem.trim()} onClick={() => start(async () => {
                const r = await disputeEngagement(e.id, problem, thread);
                if (r.error) setError(r.error); else { setDispute(false); router.refresh(); }
              })}>Send to the Redial team</Button>
              <Button size="sm" variant="ghost" onClick={() => setDispute(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

const REASONS = [
  { value: "contact_info", label: "Asking to talk or pay off Redial" },
  { value: "off_platform_payment", label: "Asking for payment outside Redial" },
  { value: "harassment", label: "Rude or harassing" },
  { value: "spam", label: "Spam or a scam" },
  { value: "no_show", label: "Didn't show up for booked work" },
  { value: "other", label: "Something else" },
];

function ReportDialog({ open, onOpenChange, thread }: { open: boolean; onOpenChange: (o: boolean) => void; thread: string }) {
  const [reason, setReason] = useState("contact_info");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setDone(false); }}>
      <DialogContent title="Report this conversation" description="The Redial team will read this conversation and follow up. The other person isn't told who reported it.">
        {done ? <p className="text-sm">Thanks. We&apos;ll take a look, usually within one business day.</p> : (
          <div className="space-y-3">
            <Pick label="Reason" value={reason} onChange={setReason} options={REASONS} />
            <Textarea rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What happened? (optional)" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={pending} onClick={() => start(async () => { const r = await reportLiveAgentThread(thread, reason, details); if (r.error) setError(r.error); else setDone(true); })}>Send report</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
