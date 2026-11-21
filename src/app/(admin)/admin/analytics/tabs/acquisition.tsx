import { ReportGrid } from "@/components/admin/analytics/report-grid";
import type { Analytics } from "@/lib/analytics/report";
import { LinkBuilder } from "./link-builder";
import { channelLabel } from "./overview";
import { SpendManager, type SpendRow } from "./spend";

const NAMES: Record<string, string> = {
  signup: "Signed up", checkout: "Started checkout", contact: "Contact form", waitlist: "App waitlist", booking: "Booked a demo",
  partners_partners: "Partner application", partners_careers: "Job application", partners_resellers: "Reseller program",
};

// Where visitors come from and what each channel and campaign brings in.
export function AcquisitionTab({ a, spend, canEdit }: { a: Analytics; spend: SpendRow[]; canEdit: boolean }) {
  const channels = a.channels.map((c) => ({
    ...c, label: channelLabel(c.channel), rate: c.sessions ? c.signups / c.sessions : null,
    cps: c.spend_cents && c.signups ? c.spend_cents / c.signups : null,
  }));
  const devices = Object.entries(a.devices).map(([device, n]) => ({ device, sessions: n }));
  return (
    <div className="space-y-8">
      <ReportGrid id="channels" title="Channels" note="Signups and revenue are credited to the channel that first brought the person."
        columns={[
          { key: "label", label: "Channel" }, { key: "sessions", label: "Visits", format: "count", bar: true }, { key: "visitors", label: "Visitors", format: "count" },
          { key: "conversions", label: "Conversions", format: "count" }, { key: "signups", label: "Signups", format: "count" }, { key: "rate", label: "Signup rate", format: "percent" },
          { key: "revenue_cents", label: "Revenue", format: "money" }, { key: "spend_cents", label: "Spend", format: "money" }, { key: "cps", label: "Cost per signup", format: "money" },
        ]} rows={channels} />
      <ReportGrid id="campaigns" title="Campaigns" note="From utm tags on links (emails and texts are tagged automatically)."
        columns={[
          { key: "campaign", label: "Campaign" }, { key: "source", label: "Source" }, { key: "medium", label: "Medium" },
          { key: "sessions", label: "Visits", format: "count", bar: true }, { key: "conversions", label: "Conversions", format: "count" }, { key: "signups", label: "Signups", format: "count" },
        ]} rows={a.campaigns} empty="No tagged campaign visits yet. Use the link builder below for anything you post." />
      <div className="grid gap-8 xl:grid-cols-2">
        <ReportGrid id="landing" title="Landing pages" columns={[
          { key: "path", label: "First page" }, { key: "sessions", label: "Visits", format: "count", bar: true }, { key: "converted", label: "Converted", format: "count" },
        ]} rows={a.landing} />
        <ReportGrid id="referrers" title="Referring sites" columns={[
          { key: "host", label: "Site" }, { key: "channel", label: "Channel" }, { key: "sessions", label: "Visits", format: "count", bar: true },
        ]} rows={a.referrers.map((r) => ({ ...r, channel: channelLabel(r.channel) }))} />
        <ReportGrid id="pages" title="Most viewed pages" columns={[
          { key: "path", label: "Page" }, { key: "views", label: "Views", format: "count", bar: true }, { key: "sessions", label: "Visits", format: "count" },
        ]} rows={a.pages} />
        <div className="space-y-8">
          <ReportGrid id="conversions" title="Conversions" columns={[{ key: "label", label: "What they did" }, { key: "count", label: "Times", format: "count", bar: true }]}
            rows={a.conversions.map((c) => ({ ...c, label: NAMES[c.name] ?? c.name }))} />
          <ReportGrid id="devices" title="Devices" columns={[{ key: "device", label: "Device" }, { key: "sessions", label: "Visits", format: "count", bar: true }]} rows={devices} />
        </div>
      </div>
      <SpendManager rows={spend} canEdit={canEdit} />
      <LinkBuilder />
    </div>
  );
}
