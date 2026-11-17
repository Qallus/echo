"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ExternalLink, Mail, MessageSquareText, Pencil, Phone, Send } from "lucide-react";
import { ClipReview, ProfileDecision } from "@/app/(admin)/admin/live-agents/review-card";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Textarea } from "@/components/ui/textarea";
import { emailLiveAgents, messageLiveAgents, textLiveAgents, updateLiveAgent } from "@/lib/admin/actions/live-agents";
import type { AdminAgent } from "@/lib/live-agents/admin-types";
import { ATTRIBUTES, money, tzLabel, WEEKDAYS } from "@/lib/live-agents/types";
import { rateLabel, StatusBadge } from "./agent-views";

export type ComposeMode = "message" | "email" | "sms";
type Msg = { text: string; error?: boolean };

function Note({ msg }: { msg?: Msg }) {
  if (!msg) return null;
  return <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.text}</p>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One agent: contact, details, voice clips and review decisions.
// ---------------------------------------------------------------------------
export function AgentPanel({ agent, skillLabel, canManage, onClose, onEdit, onCompose }: {
  agent: AdminAgent | null; skillLabel: (slug: string) => string; canManage: boolean;
  onClose: () => void; onEdit: (id: string) => void; onCompose: (ids: string[], mode: ComposeMode) => void;
}) {
  const a = agent;
  return (
    <ResponsivePanel id="admin-live-agent" open={Boolean(a)} onOpenChange={(o) => !o && onClose()} defaultWidth={560}
      title={a && (
        <div className="flex items-center gap-3">
          <AgentAvatar name={a.name} url={a.avatarUrl} online={a.availableNow} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{a.name}</h2>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><StatusBadge status={a.status} />{a.isDemo && "Demo profile"}</div>
          </div>
        </div>
      )}
      actions={a?.status === "live" && <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/live-agents/${a.handle}`} target="_blank" />}><ExternalLink /> Public profile</Button>}>
      {a && (
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Contact</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!canManage || !a.userId} onClick={() => onCompose([a.id], "message")}><Bell /> Message</Button>
              <Button size="sm" variant="outline" disabled={!canManage || !a.email} onClick={() => onCompose([a.id], "email")}><Mail /> Email</Button>
              <Button size="sm" variant="outline" disabled={!canManage || !a.phone} onClick={() => onCompose([a.id], "sms")}><MessageSquareText /> Text</Button>
              {a.phone && <Button size="sm" variant="outline" nativeButton={false} render={<a href={`tel:${a.phone}`} />}><Phone /> Call</Button>}
              {canManage && <Button size="sm" variant="outline" onClick={() => onEdit(a.id)}><Pencil /> Edit</Button>}
            </div>
            <dl className="divide-y rounded-xl border px-3">
              <Row label="Email">{a.email ? <a className="underline-offset-2 hover:underline" href={`mailto:${a.email}`}>{a.email}</a> : "No account (demo profile)"}</Row>
              <Row label="Phone">{a.phone ?? "Not on their profile"}</Row>
              <Row label="Location">{a.city}, {a.region} · {tzLabel(a.timeZone)}</Row>
              <Row label="Handle">@{a.handle}</Row>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Profile</h3>
            <p className="text-sm font-medium">{a.headline}</p>
            {a.bio && <p className="text-sm text-muted-foreground">{a.bio}</p>}
            <dl className="divide-y rounded-xl border px-3">
              <Row label="Rates">{[a.perMinuteCents != null && `${money(a.perMinuteCents, { exact: true })}/min`, a.hourlyCents != null && `${money(a.hourlyCents)}/hr`, a.retainerCents != null && `${money(a.retainerCents)}/mo (${a.retainerHours} hrs)`].filter(Boolean).join(" · ") || rateLabel(a)}</Row>
              <Row label="Experience">{a.years} {a.years === 1 ? "year" : "years"}</Row>
              <Row label="Languages">{a.languages.join(", ") || "—"}</Row>
              <Row label="Skills">{a.skills.map(skillLabel).join(", ") || "—"}</Row>
              {a.industries.length > 0 && <Row label="Industries">{a.industries.join(", ")}</Row>}
              <Row label="Setup">{[...a.workspace, ...a.equipment].map((s) => ATTRIBUTES.find((x) => x.slug === s)?.label ?? s).join(", ") || "—"}</Row>
              <Row label="Hours">{WEEKDAYS.filter(({ key }) => a.availability[key]).map(({ key, short }) => `${short} ${a.availability[key][0]}–${a.availability[key][1]}`).join(", ") || "Not set"}</Row>
              <Row label="Work">{a.engagementCount} jobs · {a.rating != null ? `${a.rating.toFixed(1)} stars (${a.reviewCount})` : "no reviews yet"}</Row>
              {a.reviewNote && <Row label="Staff note"><span className="text-amber-700 dark:text-amber-400">{a.reviewNote}</span></Row>}
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Voice clips</h3>
            {a.samples.length
              ? a.samples.map((s) => <ClipReview key={s.id} canManage={canManage} clip={{ id: s.id, title: s.title, transcript: s.transcript, url: s.url, duration_s: s.durationS, status: s.status, ai_voice: s.aiVoice }} />)
              : <p className="text-sm text-muted-foreground">No voice clips.</p>}
          </section>

          {canManage && a.status !== "archived" && (
            <section className="space-y-2 border-t pt-4">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Review</h3>
              <ProfileDecision id={a.id} status={a.status} canManage={canManage} />
            </section>
          )}
        </div>
      )}
    </ResponsivePanel>
  );
}

// ---------------------------------------------------------------------------
// Edit an agent's details.
// ---------------------------------------------------------------------------
const dollars = (c: number | null) => (c == null ? "" : String(c / 100));
const toCents = (v: string) => (v.trim() === "" ? null : Math.round(Number(v) * 100));
const TIME_ZONES = ["America/Phoenix", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York"];

export function EditPanel({ agent, onClose }: { agent: AdminAgent | null; onClose: () => void }) {
  return (
    <ResponsivePanel id="admin-live-agent-edit" open={Boolean(agent)} onOpenChange={(o) => !o && onClose()} defaultWidth={520}
      title={<h2 className="text-lg font-semibold">Edit {agent?.name}</h2>}
      description={<p className="text-sm text-muted-foreground">Changes show on their profile right away. The agent can still edit their own profile.</p>}>
      {agent && <EditForm key={agent.id} agent={agent} onDone={onClose} />}
    </ResponsivePanel>
  );
}

function EditForm({ agent: a, onDone }: { agent: AdminAgent; onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    display_name: a.name, headline: a.headline, bio: a.bio ?? "", city: a.city, region: a.region, time_zone: a.timeZone,
    years_experience: String(a.years), languages: a.languages.join(", "), hourly: dollars(a.hourlyCents), perMinute: dollars(a.perMinuteCents),
    retainer: dollars(a.retainerCents), retainerHours: a.retainerHours == null ? "" : String(a.retainerHours), review_note: a.reviewNote ?? "",
  });
  const [msg, setMsg] = useState<Msg>();
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = () => start(async () => {
    setMsg(undefined);
    const r = await updateLiveAgent(a.id, {
      display_name: f.display_name, headline: f.headline, bio: f.bio, city: f.city, region: f.region, time_zone: f.time_zone,
      years_experience: Number(f.years_experience), languages: f.languages.split(","), hourly_cents: toCents(f.hourly), per_minute_cents: toCents(f.perMinute),
      retainer_cents: toCents(f.retainer), retainer_hours: f.retainerHours.trim() === "" ? null : Number(f.retainerHours), review_note: f.review_note,
    });
    if (r.error) setMsg({ text: r.error, error: true });
    else { router.refresh(); onDone(); }
  });
  const field = (k: keyof typeof f, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5"><Label htmlFor={`la-${k}`}>{label}</Label><Input id={`la-${k}`} value={f[k]} onChange={set(k)} {...props} /></div>
  );
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {field("display_name", "Name (first name and last initial)", { maxLength: 40 })}
      {field("headline", "Headline", { maxLength: 90 })}
      <div className="space-y-1.5"><Label htmlFor="la-bio">Bio</Label><Textarea id="la-bio" rows={4} maxLength={600} value={f.bio} onChange={set("bio")} /></div>
      <div className="grid grid-cols-2 gap-3">{field("city", "City", { maxLength: 60 })}{field("region", "State", { maxLength: 30 })}</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="la-tz">Time zone</Label>
          <select id="la-tz" value={f.time_zone} onChange={set("time_zone")} className="h-9 w-full rounded-md border bg-transparent px-2 text-sm">
            {[...new Set([f.time_zone, ...TIME_ZONES])].map((tz) => <option key={tz} value={tz}>{tzLabel(tz)}</option>)}
          </select>
        </div>
        {field("years_experience", "Years of experience", { type: "number", min: 0, max: 60 })}
      </div>
      {field("languages", "Languages (comma separated)")}
      <div className="grid grid-cols-2 gap-3">
        {field("hourly", "Hourly rate ($)", { type: "number", min: 10, max: 200, step: "0.01" })}
        {field("perMinute", "Per-minute rate ($)", { type: "number", min: 0.1, max: 10, step: "0.01" })}
        {field("retainer", "Monthly plan ($)", { type: "number", min: 100, max: 20000, step: "1" })}
        {field("retainerHours", "Monthly plan hours", { type: "number", min: 5, max: 200 })}
      </div>
      <div className="space-y-1.5"><Label htmlFor="la-note">Staff note (the agent sees this on their desk)</Label><Textarea id="la-note" rows={2} maxLength={1000} value={f.review_note} onChange={set("review_note")} /></div>
      <div className="flex items-center gap-2 border-t pt-4">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
      <Note msg={msg} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Message (notifications), email or text to one or more agents.
// ---------------------------------------------------------------------------
const MODES: Record<ComposeMode, { title: string; detail: string; icon: typeof Bell }> = {
  message: { title: "Message from the Redial team", detail: "Shows in their Redial notifications, and by email or text if they've turned those on.", icon: Bell },
  email: { title: "Email", detail: "Sent from Redial and logged in Communications → Email.", icon: Mail },
  sms: { title: "Text message", detail: "Sent from Redial's number to the phone on their profile (up to 50 at a time). People who replied STOP are skipped.", icon: MessageSquareText },
};

export function ComposePanel({ target, agents, onClose }: { target: { ids: string[]; mode: ComposeMode } | null; agents: AdminAgent[]; onClose: () => void }) {
  const mode = target ? MODES[target.mode] : null;
  return (
    <ResponsivePanel id="admin-live-agent-compose" open={Boolean(target)} onOpenChange={(o) => !o && onClose()} defaultWidth={500}
      title={mode && <h2 className="flex items-center gap-2 text-lg font-semibold"><mode.icon className="size-4" /> {mode.title}</h2>}
      description={mode && <p className="text-sm text-muted-foreground">{mode.detail}</p>}>
      {target && <ComposeForm key={`${target.mode}-${target.ids.join()}`} mode={target.mode} people={agents.filter((a) => target.ids.includes(a.id))} onDone={onClose} />}
    </ResponsivePanel>
  );
}

function ComposeForm({ mode, people, onDone }: { mode: ComposeMode; people: AdminAgent[]; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<Msg>();
  const [pending, start] = useTransition();
  const reachable = people.filter((a) => (mode === "message" ? a.userId : mode === "email" ? a.email : a.phone));
  const missing = people.length - reachable.length;
  const ids = people.map((a) => a.id);
  const send = () => start(async () => {
    setMsg(undefined);
    const r = mode === "message" ? await messageLiveAgents(ids, title, body) : mode === "email" ? await emailLiveAgents(ids, title, body) : await textLiveAgents(ids, body);
    setMsg(r.error ? { text: r.error, error: true } : { text: r.ok ?? "Sent." });
    if (!r.error) { setTitle(""); setBody(""); }
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <div className="space-y-2">
        <p className="text-sm font-medium">To {reachable.length} {reachable.length === 1 ? "agent" : "agents"}</p>
        <div className="flex flex-wrap gap-1.5">
          {people.slice(0, 24).map((a) => (
            <span key={a.id} className={`flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs ${reachable.includes(a) ? "" : "opacity-50 line-through"}`}>
              <span className="scale-75"><AgentAvatar name={a.name} url={a.avatarUrl} online={false} size="sm" /></span>{a.name}
            </span>
          ))}
          {people.length > 24 && <span className="text-xs text-muted-foreground">and {people.length - 24} more</span>}
        </div>
        {missing > 0 && <p className="text-xs text-muted-foreground">{missing} crossed out: {mode === "message" ? "demo profiles have no account" : mode === "email" ? "no email address" : "no phone number on their profile"}.</p>}
      </div>
      {mode !== "sms" && (
        <div className="space-y-1.5"><Label htmlFor="compose-title">{mode === "email" ? "Subject" : "Title"}</Label>
          <Input id="compose-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required /></div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="compose-body">Message</Label>
        <Textarea id="compose-body" rows={mode === "sms" ? 4 : 8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={mode === "sms" ? 1600 : mode === "message" ? 1000 : 10000} required />
        {mode === "sms" && <p className="text-right text-[11px] text-muted-foreground">{body.length} characters{body.length > 160 && ` · ${Math.ceil(body.length / 153)} texts each`}</p>}
      </div>
      <div className="flex items-center gap-2 border-t pt-4">
        <Button type="submit" disabled={pending || !reachable.length || !body.trim() || (mode !== "sms" && !title.trim())}><Send /> {pending ? "Sending…" : `Send to ${reachable.length}`}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Close</Button>
      </div>
      <Note msg={msg} />
    </form>
  );
}
