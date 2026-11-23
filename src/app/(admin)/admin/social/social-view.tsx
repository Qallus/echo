"use client";
/* eslint-disable @next/next/no-img-element -- account pictures and post images are links on other sites */

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ExternalLink, Image as ImageIcon, Link2, Pencil, Plus, Send, Share2, Trash2, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Textarea } from "@/components/ui/textarea";
import { CollectionView } from "@/components/collection/collection-view";
import { DetailList, IconTile, muted } from "@/components/collection/kit";
import { LocalDate } from "@/components/local-date";
import { deleteSocialPost, publishSocialPostNow, removeSocialAccount, saveSocialPost, unscheduleSocialPost } from "@/lib/admin/actions/social";
import { LIMITS, POST_STATUSES, PROVIDER_LABEL, postProblems, type SocialAccount, type SocialPost, type SocialPostStatus } from "@/lib/social/types";
import { cn } from "@/lib/utils";

type Msg = { ok?: string; error?: string };
const TONE: Record<SocialPostStatus, string> = {
  draft: "bg-muted text-muted-foreground", scheduled: "bg-sky-500/15 text-sky-700 dark:text-sky-300", publishing: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", partly_published: "bg-amber-500/15 text-amber-800 dark:text-amber-300", failed: "bg-red-500/15 text-red-700 dark:text-red-300",
};
const Status = ({ s }: { s: SocialPostStatus }) => <Badge className={cn("border-transparent", TONE[s])}>{POST_STATUSES.find((x) => x.id === s)?.label}</Badge>;
const PROVIDER_TONE = { linkedin: "bg-sky-600", facebook: "bg-blue-600", instagram: "bg-pink-600" } as const;
const firstLine = (s: string) => s.split("\n").find((l) => l.trim())?.trim().slice(0, 90) || "(empty post)";
const localInput = (iso: string | null) => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function SocialView({ accounts, posts, setup, ready, notice, canSettings }: {
  accounts: SocialAccount[]; posts: SocialPost[]; setup: boolean; ready: { linkedin: boolean; meta: boolean }; notice: Msg | null; canSettings: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(notice ?? {});
  const [editing, setEditing] = useState<SocialPost | "new" | null>(null);
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<Msg>, ask?: string) => { if (ask && !confirm(ask)) return; start(async () => { const r = await fn(); setMsg(r); router.refresh(); }); };
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Removed account";

  if (!setup) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Run <code>supabase/migrations/20261124110000_social_posting.sql</code> in Supabase to turn on social posting.</p>;

  return (
    <div className="space-y-6">
      {(msg.ok || msg.error) && (
        <p className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", msg.error ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted/40")}>
          <span className="flex-1">{msg.error ?? msg.ok}</span><button type="button" aria-label="Dismiss" onClick={() => setMsg({})}><X className="size-4" /></button>
        </p>
      )}

      <section className="space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold">Accounts</h2>
          <Button size="sm" variant="outline" nativeButton={false} disabled={!ready.linkedin} render={<a href="/api/integrations/linkedin/start" />}>Connect LinkedIn</Button>
          <Button size="sm" variant="outline" nativeButton={false} disabled={!ready.meta} render={<a href="/api/integrations/meta/start" />}>Connect Facebook / Instagram</Button>
        </div>
        {(!ready.linkedin || !ready.meta) && (
          <p className="text-xs text-muted-foreground">
            {!ready.linkedin && "LinkedIn needs its Client ID and secret. "}{!ready.meta && "Facebook needs the Meta App ID and secret. "}
            {canSettings ? <Link href="/admin/settings?tab=integrations&group=social" className="underline">Add them in Integrations</Link> : "Ask an owner or admin to add them in Integrations."}
            {" "}Step-by-step: Plans → &ldquo;Social posting&rdquo;.
          </p>
        )}
        {accounts.length === 0 ? <p className="text-sm text-muted-foreground">No accounts connected yet.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                {a.picture ? <img src={a.picture} alt="" className="size-9 rounded-full object-cover" /> : <span className={cn("flex size-9 items-center justify-center rounded-full text-xs font-bold text-white", PROVIDER_TONE[a.provider])}>{PROVIDER_LABEL[a.provider][0]}</span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{PROVIDER_LABEL[a.provider]} · {a.kind === "person" ? "Profile" : "Page"}
                    {a.status !== "active" ? <span className="text-destructive"> · reconnect</span> : a.expires_at ? <> · until <LocalDate iso={a.expires_at} short /></> : null}</p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Disconnect ${a.name}`} onClick={() => act(() => removeSocialAccount(a.id), `Disconnect ${a.name}? Scheduled posts to it will fail until you reconnect.`)}><X /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CollectionView<SocialPost>
        items={posts} getId={(p) => p.id} title={(p) => firstLine(p.body)} noun={["post", "posts"]} storageKey="admin-social-posts" defaultView="list"
        empty="No posts yet. Write one, or ask Claude or an agent to draft some."
        media={() => <IconTile icon={Share2} />}
        subtitle={(p) => p.account_ids.map(nameOf).join(", ") || "No accounts"}
        badge={(p) => <Status s={p.status} />}
        meta={(p) => (p.published_at ? <>Published <LocalDate iso={p.published_at} short /></> : p.scheduled_at ? <>For <LocalDate iso={p.scheduled_at} short /></> : <>Draft · <LocalDate iso={p.created_at} short /></>)}
        searchText={(p) => `${p.body} ${p.campaign ?? ""} ${p.account_ids.map(nameOf).join(" ")}`}
        filters={[{ id: "all", label: "All", test: () => true }, ...POST_STATUSES.map((s) => ({ id: s.id, label: s.label, test: (p: SocialPost) => p.status === s.id }))]}
        columns={[
          { id: "post", label: "Post", cell: (p) => <span className="font-medium">{firstLine(p.body)}</span>, sort: (p) => p.body },
          { id: "status", label: "Status", cell: (p) => <Status s={p.status} />, sort: (p) => p.status },
          { id: "accounts", label: "Accounts", cell: (p) => muted(p.account_ids.map(nameOf).join(", ") || null) },
          { id: "when", label: "When", cell: (p) => (p.published_at || p.scheduled_at ? <LocalDate iso={(p.published_at ?? p.scheduled_at)!} short /> : muted(null)), sort: (p) => p.published_at ?? p.scheduled_at },
          { id: "campaign", label: "Campaign", cell: (p) => muted(p.campaign), sort: (p) => p.campaign },
        ]}
        board={{ lanes: POST_STATUSES.map((s) => ({ id: s.id, label: <Status s={s.id} /> })), lane: (p) => p.status }}
        date={(p) => p.published_at ?? p.scheduled_at ?? p.created_at}
        actions={[
          { label: "Delete", icon: Trash2, destructive: true, run: (rows) => { if (confirm(`Delete ${rows.length} post${rows.length === 1 ? "" : "s"} from Redial?`)) for (const p of rows) act(() => deleteSocialPost(p.id)); } },
        ]}
        preview={(p, close) => (
          <div className="space-y-4">
            <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{p.body}</p>
            {p.image_url && <img src={p.image_url} alt="" className="max-h-64 rounded-lg border object-contain" />}
            <DetailList rows={[["Accounts", p.account_ids.map(nameOf).join(", ") || "—"], ["Link", p.link_url ?? "—"], ["Campaign", p.campaign ?? "—"],
              ["Scheduled", p.scheduled_at ? <LocalDate key="s" iso={p.scheduled_at} /> : "—"], ["Published", p.published_at ? <LocalDate key="p" iso={p.published_at} /> : "—"]]} />
            {p.results.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {p.results.map((r) => (
                  <li key={r.account_id + r.at} className="flex items-start gap-2">
                    <Badge className={cn("border-transparent", r.ok ? TONE.published : TONE.failed)}>{r.ok ? "Posted" : "Failed"}</Badge>
                    <span className="min-w-0 flex-1">{r.name}{r.ok && r.url ? <> · <a href={r.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">View <ExternalLink className="inline size-3" /></a></> : r.error ? <span className="text-destructive"> · {r.error}</span> : null}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {["draft", "scheduled", "failed", "partly_published"].includes(p.status) && (
                <Button size="sm" disabled={pending} onClick={() => act(() => publishSocialPostNow(p.id), `Publish to ${p.account_ids.map(nameOf).join(", ")} now?`)}><Send /> {p.status === "failed" || p.status === "partly_published" ? "Try again" : "Publish now"}</Button>
              )}
              {["draft", "scheduled", "failed"].includes(p.status) && <Button size="sm" variant="outline" onClick={() => { close(); setEditing(p); }}><Pencil /> Edit</Button>}
              {p.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => act(() => unscheduleSocialPost(p.id))}><Undo2 /> Back to draft</Button>}
            </div>
          </div>
        )}
        toolbar={<Button onClick={() => setEditing("new")}><Plus /> New post</Button>}
      />
      {editing && <Composer post={editing === "new" ? null : editing} accounts={accounts} onClose={() => setEditing(null)} onSaved={(r) => { setMsg(r); setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function Composer({ post, accounts, onClose, onSaved }: { post: SocialPost | null; accounts: SocialAccount[]; onClose: () => void; onSaved: (r: Msg) => void }) {
  const [body, setBody] = useState(post?.body ?? "");
  const [image, setImage] = useState(post?.image_url ?? "");
  const [link, setLink] = useState(post?.link_url ?? "");
  const [campaign, setCampaign] = useState(post?.campaign ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(post?.account_ids ?? accounts.filter((a) => a.status === "active").map((a) => a.id)));
  const [when, setWhen] = useState(localInput(post?.scheduled_at ?? null));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const chosen = accounts.filter((a) => picked.has(a.id));
  const tightest = chosen.length ? Math.min(...chosen.map((a) => LIMITS[a.provider])) : 3000;
  const problems = postProblems({ body, image_url: image || null }, chosen);
  const save = (status: "draft" | "scheduled") => start(async () => {
    const r = await saveSocialPost(post?.id ?? null, { body, image_url: image || null, link_url: link || null, campaign: campaign || null, account_ids: [...picked], status, scheduled_at: status === "scheduled" ? new Date(when).toISOString() : null });
    if (r.error) setError(r.error); else onSaved(r);
  });
  return (
    <ResponsivePanel open onOpenChange={(o) => !o && onClose()} id="social-compose" title={post ? "Edit post" : "New post"} defaultWidth={620} fullHeight
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="outline" disabled={pending || !body.trim()} onClick={() => save("draft")}>Save draft</Button>
          <Button disabled={pending || problems.length > 0} onClick={() => save("scheduled")}><CalendarClock /> Schedule</Button>
        </div>
      }>
      <div className="space-y-1.5">
        <Label>Post to</Label>
        {accounts.length === 0 ? <p className="text-sm text-muted-foreground">Connect an account first. You can still save a draft.</p> : (
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <label key={a.id} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", picked.has(a.id) && "border-primary bg-primary/5", a.status !== "active" && "opacity-60")}>
                <Checkbox checked={picked.has(a.id)} onCheckedChange={() => setPicked((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} />
                {a.name} <span className="text-xs text-muted-foreground">{PROVIDER_LABEL[a.provider]}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sp-body">Post</Label>
        <Textarea id="sp-body" rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What do you want to say? One idea, plain words, end with a question." />
        <p className={cn("text-right text-xs", body.length > tightest ? "text-destructive" : "text-muted-foreground")}>{body.length}/{tightest}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="sp-img" className="flex items-center gap-1.5"><ImageIcon className="size-3.5" /> Image link (optional; Instagram needs one)</Label><Input id="sp-img" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…/image.jpg" /></div>
        <div className="space-y-1.5"><Label htmlFor="sp-link" className="flex items-center gap-1.5"><Link2 className="size-3.5" /> Link (optional)</Label><Input id="sp-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://redial.si/…" /></div>
        <div className="space-y-1.5"><Label htmlFor="sp-camp">Campaign (for Analytics)</Label><Input id="sp-camp" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="e.g. scam-week" /></div>
        <div className="space-y-1.5"><Label htmlFor="sp-when">Publish at</Label><Input id="sp-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
      </div>
      {image && /^https:\/\//.test(image) && <img src={image} alt="" className="max-h-48 rounded-lg border object-contain" />}
      {problems.length > 0 && body.trim() && <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      <p className="text-xs text-muted-foreground">Links to redial.si get campaign tags automatically, so visits and signups show in Analytics → Social. Scheduled posts go out within 5 minutes of their time.</p>
    </ResponsivePanel>
  );
}
