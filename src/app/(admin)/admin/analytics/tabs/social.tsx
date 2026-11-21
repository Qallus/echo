import type { SupabaseClient } from "@supabase/supabase-js";
import { ReportGrid } from "@/components/admin/analytics/report-grid";
import type { Analytics } from "@/lib/analytics/report";
import { SocialManager, NETWORK_LABELS, type SocialRow } from "./social-manager";

// Social and Google Business Profile: traffic and signups from social (from
// tracking, works now) and each network's own numbers (entered monthly until
// the LinkedIn, Meta and Business Profile connections are approved).
export async function SocialTab({ supabase, a, canEdit }: { supabase: SupabaseClient; a: Analytics; canEdit: boolean }) {
  const { data } = await supabase.from("social_stats").select("*").order("month", { ascending: false }).limit(200);
  const rows = (data ?? []) as SocialRow[];
  const social = a.channels.find((c) => c.channel === "social");
  const sites = a.referrers.filter((r) => r.channel === "social");
  return (
    <div className="space-y-8">
      <ReportGrid id="social-traffic" title="Visits from social" note={social ? `${social.sessions} visits, ${social.signups} signups this period` : undefined}
        columns={[{ key: "host", label: "Site" }, { key: "sessions", label: "Visits", format: "count", bar: true }]} rows={sites}
        empty="No social visits yet. Tag your posts with the link builder (Acquisition tab) so they're counted." />
      <ReportGrid id="social-campaigns" title="Tagged social posts and ads" columns={[
        { key: "campaign", label: "Campaign" }, { key: "source", label: "Network" }, { key: "sessions", label: "Visits", format: "count", bar: true }, { key: "signups", label: "Signups", format: "count" },
      ]} rows={a.campaigns.filter((c) => c.medium && /social|post|paid_social/.test(c.medium))} empty="No tagged social links visited yet." />
      <ReportGrid id="social-networks" title="Network numbers by month" columns={[
        { key: "month", label: "Month" }, { key: "network", label: "Network" }, { key: "followers", label: "Followers", format: "count" }, { key: "reach", label: "Reach", format: "count", bar: true },
        { key: "engagements", label: "Engagements", format: "count" }, { key: "posts", label: "Posts", format: "count" }, { key: "clicks", label: "Clicks", format: "count" }, { key: "calls", label: "Calls", format: "count" },
      ]} rows={rows.map((r) => ({ ...r, month: r.month.slice(0, 7), network: NETWORK_LABELS[r.network] ?? r.network }))} empty="No network numbers yet. Add them below each month." />
      <SocialManager rows={rows} canEdit={canEdit} />
    </div>
  );
}
