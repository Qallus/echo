import type { SupabaseClient } from "@supabase/supabase-js";
import { StatRow, StatTile } from "@/components/admin/crm/crm-kit";
import { ReportGrid } from "@/components/admin/analytics/report-grid";
import { campaignSlug } from "@/lib/analytics/utm";
import type { Analytics } from "@/lib/analytics/report";

type Send = { campaign_id: string | null; subject: string; status: string; delivered_at: string | null; opened_at: string | null; clicked_at: string | null; bounced_at: string | null; complained_at: string | null };

const end = (until: string) => { const d = new Date(`${until}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString(); };

// Email and texts: delivery and engagement, plus the visits, signups and
// sales each campaign brought in (links are tagged automatically).
export async function EmailSmsTab({ supabase, a, since, until }: { supabase: SupabaseClient; a: Analytics; since: string; until: string }) {
  const from = `${since}T00:00:00Z`, to = end(until);
  const [{ data: sends }, { data: campaigns }, { data: texts }, { count: optOuts }, { data: links }] = await Promise.all([
    supabase.from("email_sends").select("campaign_id, subject, status, delivered_at, opened_at, clicked_at, bounced_at, complained_at").gte("created_at", from).lt("created_at", to).neq("status", "test").limit(50000),
    supabase.from("email_campaigns").select("id, subject, created_at, total, sent").gte("created_at", from).lt("created_at", to).order("created_at", { ascending: false }).limit(100),
    supabase.from("phone_messages").select("direction, status").gte("created_at", from).lt("created_at", to).limit(50000),
    supabase.from("phone_opt_outs").select("number", { count: "exact", head: true }).gte("created_at", from).lt("created_at", to),
    supabase.from("short_links").select("code, url, channel, campaign, clicks, last_click_at, created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const s = (sends ?? []) as Send[];
  const sent = s.filter((x) => x.status === "sent");
  const rate = (n: number) => (sent.length ? n / sent.length : 0);
  const visits = new Map(a.campaigns.filter((c) => c.medium === "email").map((c) => [c.campaign ?? "", c]));
  const byCampaign = (campaigns ?? []).map((c) => {
    const mine = sent.filter((x) => x.campaign_id === c.id);
    const v = visits.get(campaignSlug(c.subject));
    return {
      subject: c.subject, date: c.created_at.slice(0, 10), sent: mine.length || c.sent,
      opened: mine.length ? mine.filter((x) => x.opened_at).length / mine.length : null, clicked: mine.length ? mine.filter((x) => x.clicked_at).length / mine.length : null,
      bounced: mine.filter((x) => x.bounced_at).length, visits: v?.sessions ?? 0, signups: v?.signups ?? 0,
    };
  });
  const t = texts ?? [];
  const out = t.filter((m) => m.direction === "outbound");
  const delivered = out.filter((m) => m.status === "delivered").length;
  const failed = out.filter((m) => m.status === "failed" || m.status === "undelivered").length;
  const textCampaigns = a.campaigns.filter((c) => c.medium === "sms" || c.medium === "text");

  return (
    <div className="space-y-8">
      <StatRow>
        <StatTile label="Emails sent" value={sent.length.toLocaleString()} hint={`${s.filter((x) => x.status === "skipped").length} skipped (unsubscribed)`} />
        <StatTile label="Opened" value={`${Math.round(rate(sent.filter((x) => x.opened_at).length) * 100)}%`} hint="Apple Mail can inflate opens" />
        <StatTile label="Clicked" value={`${Math.round(rate(sent.filter((x) => x.clicked_at).length) * 100)}%`} />
        <StatTile label="Bounced or complained" value={(sent.filter((x) => x.bounced_at || x.complained_at).length).toLocaleString()} />
      </StatRow>
      <ReportGrid id="email-campaigns" title="Email campaigns" note="Visits and signups come from the tagged links in each email."
        columns={[
          { key: "subject", label: "Subject" }, { key: "date", label: "Sent on" }, { key: "sent", label: "Sent", format: "count" }, { key: "opened", label: "Opened", format: "percent" },
          { key: "clicked", label: "Clicked", format: "percent", bar: true }, { key: "bounced", label: "Bounced", format: "count" }, { key: "visits", label: "Visits", format: "count" }, { key: "signups", label: "Signups", format: "count" },
        ]} rows={byCampaign} empty="No email campaigns in this period." />

      <StatRow>
        <StatTile label="Texts sent" value={out.length.toLocaleString()} />
        <StatTile label="Delivered" value={out.length ? `${Math.round((delivered / out.length) * 100)}%` : "—"} hint={failed ? `${failed} failed` : undefined} />
        <StatTile label="Replies" value={t.filter((m) => m.direction === "inbound").length.toLocaleString()} />
        <StatTile label="Opted out (STOP)" value={(optOuts ?? 0).toLocaleString()} />
      </StatRow>
      <div className="grid gap-8 xl:grid-cols-2">
        <ReportGrid id="sms-links" title="Short links (texts and posts)" note="redial.si/l/… links count every tap."
          columns={[{ key: "link", label: "Link" }, { key: "campaign", label: "Campaign" }, { key: "channel", label: "Used in" }, { key: "clicks", label: "Taps", format: "count", bar: true }]}
          rows={(links ?? []).map((l) => ({ ...l, link: `/l/${l.code}` }))} empty="No short links yet. Make one in the link builder (Acquisition tab)." />
        <ReportGrid id="sms-campaigns" title="Visits from text campaigns" columns={[{ key: "campaign", label: "Campaign" }, { key: "sessions", label: "Visits", format: "count", bar: true }, { key: "signups", label: "Signups", format: "count" }]}
          rows={textCampaigns} empty="No tagged text links visited yet." />
      </div>
    </div>
  );
}
