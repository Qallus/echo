import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { Badge } from "@/components/ui/badge";
import { can, requireStaff } from "@/lib/admin/guard";
import { listSkills, mediaUrl } from "@/lib/live-agents/data";
import { AGENT_STATUS } from "@/lib/live-agents/setup";
import { ATTRIBUTES, money, WEEKDAYS, type Weekday } from "@/lib/live-agents/types";
import { createClient } from "@/lib/supabase/server";
import { ClipReview, ProfileDecision, type AdminClip } from "./review-card";

export const metadata = { title: "Live Agents · Admin · Echo" };

type Row = {
  id: string; user_id: string | null; email: string | null; handle: string; display_name: string; headline: string; bio: string | null; city: string; region: string;
  years_experience: number; languages: string[]; industries: string[]; skills: string[]; equipment: string[]; workspace: string[]; experience: { title: string; detail?: string }[];
  per_minute_cents: number | null; hourly_cents: number | null; retainer_cents: number | null; retainer_hours: number | null;
  availability: Partial<Record<Weekday, [string, string]>>; avatar_url: string | null; status: string; is_demo: boolean; review_note: string | null;
  submitted_at: string | null; approved_at: string | null; created_at: string; updated_at: string;
  samples: { id: string; title: string; transcript: string | null; storage_path: string; duration_s: number | null; status: string; ai_voice: boolean }[];
};

// Live Agents marketplace: the review queue (new profiles, and new voice
// clips on live profiles) and every listing.
export default async function LiveAgentsAdminPage() {
  const staff = await requireStaff("marketplace.view");
  const manage = can(staff, "marketplace.manage");
  const supabase = await createClient();
  const [{ data, error }, skills] = await Promise.all([supabase.rpc("admin_live_agents"), listSkills()]);
  if (error) {
    return (
      <AdminPage title="Live Agents" description="Real people businesses can book to answer their calls.">
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Run the Live Agents onboarding migration (20261113120000_live_agents_onboarding.sql) to turn on the review queue.</p>
      </AdminPage>
    );
  }
  const rows = (data ?? []) as Row[];
  const label = (s: string) => skills.find((k) => k.slug === s)?.label ?? s;
  const queue = rows.filter((r) => r.status === "pending" || (r.status === "live" && r.samples.some((s) => s.status === "pending")));
  const count = (s: string) => rows.filter((r) => r.status === s && !r.is_demo).length;

  return (
    <AdminPage title="Live Agents" description="Real people businesses can book to answer their calls. Approve profiles and voice clips before they're public.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="To review" value={queue.length} />
        <StatCard label="Live" value={count("live")} hint={`${rows.filter((r) => r.is_demo && r.status === "live").length} demo profiles`} />
        <StatCard label="Drafts" value={count("draft")} />
        <StatCard label="Paused" value={count("paused")} />
        <StatCard label="Suspended" value={count("suspended")} />
      </div>

      <Section title="Review queue" description="New profiles, and new voice clips on live profiles. Check photos and clips for contact details, other people or anything off-brand.">
        {queue.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nothing to review right now.</p>
        ) : (
          <div className="space-y-4">
            {queue.map((r) => (
              <article key={r.id} className="space-y-4 rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <AgentAvatar name={r.display_name} url={r.avatar_url ? mediaUrl(r.avatar_url) : null} online={false} size="lg" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{r.display_name}</h3>
                      <Badge variant={AGENT_STATUS[r.status]?.tone ?? "outline"}>{AGENT_STATUS[r.status]?.label ?? r.status}</Badge>
                    </div>
                    <p className="text-sm">{r.headline}</p>
                    <p className="text-xs text-muted-foreground">{r.email ?? "No account"} · {r.city}, {r.region} · {r.years_experience} years · {r.languages.join(", ")}{r.submitted_at && <> · sent <LocalDate iso={r.submitted_at} /></>}</p>
                  </div>
                  {!r.avatar_url && <Badge variant="outline">No photo</Badge>}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 text-sm">
                    {r.bio && <p className="text-muted-foreground">{r.bio}</p>}
                    <p><span className="font-medium">Skills:</span> {r.skills.map(label).join(", ") || "None"}</p>
                    {r.industries.length > 0 && <p><span className="font-medium">Industries:</span> {r.industries.join(", ")}</p>}
                    <p><span className="font-medium">Workspace and equipment:</span> {[...(r.workspace ?? []), ...(r.equipment ?? [])].map((s) => ATTRIBUTES.find((x) => x.slug === s)?.label ?? s).join(", ") || "None"}</p>
                    {r.experience.length > 0 && <ul className="list-inside list-disc text-muted-foreground">{r.experience.map((e, i) => <li key={i}>{e.title}{e.detail ? ` · ${e.detail}` : ""}</li>)}</ul>}
                    <p>
                      <span className="font-medium">Rates:</span>{" "}
                      {[r.per_minute_cents != null && `${money(r.per_minute_cents, { exact: true })}/min`, r.hourly_cents != null && `${money(r.hourly_cents)}/hr`, r.retainer_cents != null && `${money(r.retainer_cents)}/mo (${r.retainer_hours} hrs)`].filter(Boolean).join(" · ") || "None"}
                    </p>
                    <p><span className="font-medium">Hours:</span> {WEEKDAYS.filter(({ key }) => r.availability[key]).map(({ key, short }) => `${short} ${r.availability[key]![0]}–${r.availability[key]![1]}`).join(", ") || "None"}</p>
                  </div>
                  <div className="space-y-3">
                    {r.samples.length ? r.samples.map((s) => (
                      <ClipReview key={s.id} canManage={manage} clip={{ id: s.id, title: s.title, transcript: s.transcript, url: mediaUrl(s.storage_path), duration_s: s.duration_s, status: s.status, ai_voice: s.ai_voice } satisfies AdminClip} />
                    )) : <p className="text-sm text-muted-foreground">No voice clips.</p>}
                  </div>
                </div>
                <div className="border-t pt-4"><ProfileDecision id={r.id} status={r.status} canManage={manage} /></div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title="All profiles">
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2 font-medium">Agent</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Where</th><th className="px-3 py-2 font-medium">Rate</th><th className="px-3 py-2 font-medium">Clips</th><th className="px-3 py-2 font-medium">Updated</th><th className="px-3 py-2 font-medium">Actions</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.display_name} {r.is_demo && <Badge variant="outline" className="ml-1">Demo</Badge>}</p>
                    <p className="text-xs text-muted-foreground">{r.email ?? "—"}</p>
                    {r.review_note && <p className="mt-1 max-w-xs text-xs text-amber-700 dark:text-amber-400">Note: {r.review_note}</p>}
                  </td>
                  <td className="px-3 py-2"><Badge variant={AGENT_STATUS[r.status]?.tone ?? "outline"}>{AGENT_STATUS[r.status]?.label ?? r.status}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{r.city}, {r.region}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.hourly_cents != null ? `${money(r.hourly_cents)}/hr` : r.per_minute_cents != null ? `${money(r.per_minute_cents, { exact: true })}/min` : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.samples.length}{r.samples.some((s) => s.status === "pending") && " (new)"}</td>
                  <td className="px-3 py-2 text-muted-foreground"><LocalDate iso={r.updated_at} short /></td>
                  <td className="space-y-2 px-3 py-2">
                    {r.status === "live" && <Link href={`/live-agents/${r.handle}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="size-3" /> View</Link>}
                    {r.status !== "pending" && <ProfileDecision id={r.id} status={r.status} canManage={manage} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </AdminPage>
  );
}
