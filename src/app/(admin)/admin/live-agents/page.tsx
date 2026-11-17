import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { Badge } from "@/components/ui/badge";
import { can, requireStaff } from "@/lib/admin/guard";
import { listSkills } from "@/lib/live-agents/data";
import { listAdminAgents } from "@/lib/live-agents/admin";
import { AgentsManager } from "@/components/admin/live-agents/agents-manager";
import { AGENT_STATUS } from "@/lib/live-agents/setup";
import { ATTRIBUTES, money, WEEKDAYS } from "@/lib/live-agents/types";
import { createClient } from "@/lib/supabase/server";
import { adminAudit } from "@/lib/admin/audit";
import { ClipReview, MoneyActions, ProfileDecision, ResolveReport, type AdminClip } from "./review-card";

export const metadata = { title: "Live Agents · Admin · Redial" };


// Live Agents marketplace: the review queue (new profiles, and new voice
// clips on live profiles) and every listing.
export default async function LiveAgentsAdminPage() {
  const staff = await requireStaff("marketplace.view");
  const manage = can(staff, "marketplace.manage");
  const supabase = await createClient();
  const [{ agents: rows, error }, skills] = await Promise.all([listAdminAgents(supabase), listSkills()]);
  if (error) {
    return (
      <AdminPage title="Live Agents" description="Real people businesses can book to answer their calls.">
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Run the Live Agents admin migration (20261117150000_live_agents_admin_manage.sql) in the Supabase SQL Editor to turn this page on.</p>
      </AdminPage>
    );
  }
  type Report = { id: string; thread_id: string | null; agent_name: string | null; business_name: string | null; reporter_side: string; reason: string; details: string | null; status: string; created_at: string; messages: { side: string; body: string; at: string }[] };
  const { data: rep } = await supabase.rpc("admin_live_agent_reports");
  const reports = ((rep ?? []) as Report[]);
  const openReports = reports.filter((r) => r.status === "open");
  type Money = {
    engagement_id: string; agent_name: string; business_name: string; type: string; eng_status: string; paid_at: string; completed_at: string | null;
    disputed_at: string | null; dispute_note: string | null; payment_intent: string | null; amount_cents: number | null; refunded_cents: number | null;
    payment_status: string | null; payout_id: string | null; payout_cents: number | null; payout_status: string | null; payout_failure: string | null;
  };
  const { data: moneyData } = await supabase.rpc("admin_live_agent_money");
  const payments = (moneyData ?? []) as Money[];
  // Staff read reported conversations only; each view is logged.
  if (openReports.length) await adminAudit(supabase, "live_agents.reports_viewed", undefined, { reports: openReports.map((r) => r.id) });
  const label = (s: string) => skills.find((k) => k.slug === s)?.label ?? s;
  const queue = rows.filter((r) => r.status === "pending" || (r.status === "live" && r.samples.some((s) => s.status === "pending")));
  const count = (s: string) => rows.filter((r) => r.status === s && !r.isDemo).length;

  return (
    <AdminPage title="Live Agents" description="Real people businesses can book to answer their calls. Approve profiles and voice clips before they're public.">
      <div className="stat-row grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="To review" value={queue.length} />
        <StatCard label="Live" value={count("live")} hint={`${rows.filter((r) => r.isDemo && r.status === "live").length} demo profiles`} />
        <StatCard label="Drafts" value={count("draft")} />
        <StatCard label="Paused" value={count("paused")} />
        <StatCard label="Blocked" value={count("suspended")} />
      </div>

      <Section title="Review queue" description="New profiles, and new voice clips on live profiles. Check photos and clips for contact details, other people or anything off-brand.">
        {queue.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nothing to review right now.</p>
        ) : (
          <div className="space-y-4">
            {queue.map((r) => (
              <article key={r.id} className="space-y-4 rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <AgentAvatar name={r.name} url={r.avatarUrl} online={false} size="lg" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{r.name}</h3>
                      <Badge variant={AGENT_STATUS[r.status]?.tone ?? "outline"}>{AGENT_STATUS[r.status]?.label ?? r.status}</Badge>
                    </div>
                    <p className="text-sm">{r.headline}</p>
                    <p className="text-xs text-muted-foreground">{r.email ?? "No account"} · {r.city}, {r.region} · {r.years} years · {r.languages.join(", ")}{r.submittedAt && <> · sent <LocalDate iso={r.submittedAt} /></>}</p>
                  </div>
                  {!r.avatarUrl && <Badge variant="outline">No photo</Badge>}
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
                      {[r.perMinuteCents != null && `${money(r.perMinuteCents, { exact: true })}/min`, r.hourlyCents != null && `${money(r.hourlyCents)}/hr`, r.retainerCents != null && `${money(r.retainerCents)}/mo (${r.retainerHours} hrs)`].filter(Boolean).join(" · ") || "None"}
                    </p>
                    <p><span className="font-medium">Hours:</span> {WEEKDAYS.filter(({ key }) => r.availability[key]).map(({ key, short }) => `${short} ${r.availability[key][0]}–${r.availability[key][1]}`).join(", ") || "None"}</p>
                  </div>
                  <div className="space-y-3">
                    {r.samples.length ? r.samples.map((s) => (
                      <ClipReview key={s.id} canManage={manage} clip={{ id: s.id, title: s.title, transcript: s.transcript, url: s.url, duration_s: s.durationS, status: s.status, ai_voice: s.aiVoice } satisfies AdminClip} />
                    )) : <p className="text-sm text-muted-foreground">No voice clips.</p>}
                  </div>
                </div>
                <div className="border-t pt-4"><ProfileDecision id={r.id} status={r.status} canManage={manage} /></div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title="All agents" description="Switch between list, table, cards, map and calendar. Tick agents to contact, edit, archive, block or delete them in one go.">
        <AgentsManager agents={rows} skills={skills.map((k) => ({ slug: k.slug, label: k.label }))} canManage={manage} />
      </Section>

      {reports.length > 0 && (
        <Section title="Reported conversations" description="Only reported conversations are visible to staff, and every view is logged.">
          <div className="space-y-3">
            {reports.slice(0, 20).map((r) => (
              <details key={r.id} className="rounded-2xl border bg-card p-4" open={r.status === "open"}>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                  <Badge variant={r.status === "open" ? "destructive" : "outline"}>{r.status === "open" ? "Open" : "Resolved"}</Badge>
                  <span className="font-medium">{r.reason.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">· {r.business_name ?? "Business"} and {r.agent_name ?? "Live Agent"} · reported by the {r.reporter_side} · <LocalDate iso={r.created_at} /></span>
                </summary>
                {r.details && <p className="mt-3 text-sm">{r.details}</p>}
                <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto rounded-xl bg-muted/40 p-3 text-sm">
                  {r.messages.map((m, i) => <p key={i}><span className="font-medium capitalize">{m.side}:</span> {m.body}</p>)}
                </div>
                {r.status === "open" && manage && <div className="mt-3"><ResolveReport id={r.id} /></div>}
              </details>
            ))}
          </div>
        </Section>
      )}

      {payments.length > 0 && (
        <Section title="Payments and payouts" description="Businesses pay up front. Payouts go out 3 days after work is complete unless a problem is reported.">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Booking</th><th className="px-3 py-2 font-medium">Paid</th><th className="px-3 py-2 font-medium">Payout</th><th className="px-3 py-2 font-medium">Actions</th></tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((m) => (
                  <tr key={m.engagement_id} className="align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{m.business_name} → {m.agent_name}</p>
                      <p className="text-xs text-muted-foreground">{m.type.replace("_", "-")} · {m.eng_status}{m.completed_at && <> · done <LocalDate iso={m.completed_at} short /></>}</p>
                      {m.disputed_at && <p className="mt-1 max-w-sm text-xs text-destructive">Problem reported: {m.dispute_note}</p>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.amount_cents ? money(m.amount_cents, { exact: true }) : "Card saved"}{m.refunded_cents ? ` (refunded ${money(m.refunded_cents, { exact: true })})` : ""}
                      <br /><LocalDate iso={m.paid_at} short />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.payout_id ? <>{money(m.payout_cents ?? 0, { exact: true })} · {m.payout_status}{m.payout_failure && <><br /><span className="text-xs">{m.payout_failure}</span></>}</> : "Not yet"}
                    </td>
                    <td className="px-3 py-2">{manage && <MoneyActions paymentIntent={m.payment_intent} engagementId={m.engagement_id} payoutId={m.payout_id} payoutStatus={m.payout_status} refunded={m.payment_status === "refunded"} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

    </AdminPage>
  );
}
