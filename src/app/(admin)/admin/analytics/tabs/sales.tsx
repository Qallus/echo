import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ReportGrid } from "@/components/admin/analytics/report-grid";
import { effectiveProvider, PROVIDERS } from "@/lib/prospects/carriers";

const end = (until: string) => { const d = new Date(`${until}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString(); };

// Sales: the prospecting funnel by phone provider, and where leads come from.
export async function SalesTab({ supabase, since, until }: { supabase: SupabaseClient; since: string; until: string }) {
  const from = `${since}T00:00:00Z`, to = end(until);
  const [{ data: prospects }, { data: leads }, { data: deals }] = await Promise.all([
    supabase.from("prospects").select("phone_e164, crm_contact_id, status, provider_override").is("workspace_id", null).gte("created_at", from).lt("created_at", to).limit(20000),
    supabase.from("crm_contacts").select("id, source, lead_status, role").gte("created_at", from).lt("created_at", to).limit(20000),
    supabase.from("crm_deals").select("contact_id, stage, value_cents").gte("created_at", from).lt("created_at", to).limit(20000),
  ]);
  const ps = prospects ?? [];
  const { data: looked } = ps.length
    ? await supabase.from("phone_lookups").select("phone_e164, carrier_name, line_type").in("phone_e164", ps.slice(0, 1000).map((p) => p.phone_e164))
    : { data: [] as { phone_e164: string; carrier_name: string | null; line_type: string | null }[] };
  const lk = new Map((looked ?? []).map((l) => [l.phone_e164, l]));
  const dealBy = new Map<string, { stage: string; value_cents: number }[]>();
  for (const d of deals ?? []) if (d.contact_id) dealBy.set(d.contact_id, [...(dealBy.get(d.contact_id) ?? []), d]);

  const funnel = new Map<string, { provider: string; prospects: number; looked: number; leads: number; deals: number; won: number }>();
  for (const p of ps) {
    const e = effectiveProvider(lk.get(p.phone_e164) ?? null, p.provider_override);
    const key = e.provider ? PROVIDERS[e.provider].label : "Not looked up";
    const f = funnel.get(key) ?? { provider: key, prospects: 0, looked: 0, leads: 0, deals: 0, won: 0 };
    f.prospects++;
    if (e.provider) f.looked++;
    if (p.crm_contact_id) {
      f.leads++;
      const ds = dealBy.get(p.crm_contact_id) ?? [];
      if (ds.length) f.deals++;
      if (ds.some((d) => d.stage === "closed_won")) f.won++;
    }
    funnel.set(key, f);
  }
  const sources = new Map<string, { source: string; contacts: number; leads: number; deals: number; won_cents: number }>();
  for (const c of leads ?? []) {
    const key = c.source || "Not set";
    const s = sources.get(key) ?? { source: key, contacts: 0, leads: 0, deals: 0, won_cents: 0 };
    s.contacts++;
    if (c.lead_status) s.leads++;
    const ds = dealBy.get(c.id) ?? [];
    if (ds.length) s.deals++;
    s.won_cents += ds.filter((d) => d.stage === "closed_won").reduce((n, d) => n + d.value_cents, 0);
    sources.set(key, s);
  }
  return (
    <div className="space-y-8">
      <ReportGrid id="prospect-funnel" title="Prospecting funnel by phone provider" note="Prospects added in this period."
        columns={[
          { key: "provider", label: "Provider" }, { key: "prospects", label: "Prospects", format: "count", bar: true }, { key: "looked", label: "Looked up", format: "count" },
          { key: "leads", label: "Became leads", format: "count" }, { key: "deals", label: "In pipeline", format: "count" }, { key: "won", label: "Won", format: "count" },
        ]} rows={[...funnel.values()].sort((a, b) => b.prospects - a.prospects)} empty="No prospects added in this period." />
      <ReportGrid id="lead-sources" title="Where contacts and leads came from" note="Contacts added in this period, by their source."
        columns={[
          { key: "source", label: "Source" }, { key: "contacts", label: "Contacts", format: "count", bar: true }, { key: "leads", label: "Leads", format: "count" },
          { key: "deals", label: "Deals", format: "count" }, { key: "won_cents", label: "Won value", format: "money" },
        ]} rows={[...sources.values()].sort((a, b) => b.contacts - a.contacts)} />
      <p className="text-sm text-muted-foreground">Pipeline, win rate and owner reports are in <Link href="/admin/reports" className="underline">Reports</Link>.</p>
    </div>
  );
}
