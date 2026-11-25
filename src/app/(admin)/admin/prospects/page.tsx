import { ShieldAlert } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { StatRow, StatTile } from "@/components/admin/crm/crm-kit";
import { can } from "@/lib/admin/guard";
import { crmGuard as requireStaff } from "@/lib/crm/scope";
import { listProspects } from "@/lib/prospects/data";
import { mapCarrier } from "@/lib/prospects/carriers";
import { loadProspecting } from "@/lib/prospects/settings";
import { createClient } from "@/lib/supabase/server";
import { ProspectsList } from "./prospects-list";

export const metadata = { title: "Prospects · Admin · Redial" };

// Business numbers to prospect: import a list, look up who carries each
// number (Twilio), and send the best fits to Leads.
// Spec: docs/Prospecting/06-PROSPECT-CARRIER-LOOKUP.md.
export default async function ProspectsPage() {
  const staff = await requireStaff("crm.view");
  const supabase = await createClient();
  const [rows, settings, { data: odd }] = await Promise.all([
    listProspects(supabase), loadProspecting(supabase),
    supabase.from("phone_lookups").select("carrier_name, line_type").in("confidence", ["possible", "unknown"]).not("carrier_name", "is", null).limit(3000),
  ]);
  const manage = can(staff, "crm.manage");
  // Carrier names that matched no provider rule (only the line type placed them).
  const counts = new Map<string, number>();
  for (const l of odd ?? []) {
    if (mapCarrier(l.carrier_name, null).provider !== "unknown") continue;
    counts.set(l.carrier_name!, (counts.get(l.carrier_name!) ?? 0) + 1);
  }
  const unmapped = [...counts].map(([carrier, count]) => ({ carrier, count })).sort((a, b) => b.count - a.count);
  const has = (p: string) => rows.filter((r) => r.provider === p).length;

  return (
    <AdminPage title="Prospects" description="Business numbers to call on: who carries each number, how good a fit it is, and where it is in your outreach.">
      <StatRow>
        <StatTile label="Prospects" value={rows.length} hint={`${rows.filter((r) => r.lookup).length} looked up`} />
        <StatTile label="RingCentral" value={has("ringcentral")} hint={`${rows.filter((r) => r.provider === "ringcentral" && r.confidence === "confirmed").length} confirmed`} />
        <StatTile label="Cox or Spectrum" value={has("cox") + has("spectrum")} />
        <StatTile label="On a cell phone" value={has("mobile")} accent />
      </StatRow>

      <details className="rounded-xl border p-4 text-sm text-muted-foreground">
        <summary className="flex cursor-pointer items-center gap-2 font-medium text-foreground"><ShieldAlert className="size-4" /> Rules for this list</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Business numbers only. Don&apos;t import personal or household lists.</li>
          <li>Reach out by phone (a person calling, after checking mobile numbers against the National Do Not Call Registry) and by email.</li>
          <li>No cold texts and no automated or AI-voice calls to anyone on this list.</li>
          <li>Do not contact is permanent and blocks every outreach action.</li>
          <li>Lookup results are for internal use. Don&apos;t publish them.</li>
        </ul>
      </details>

      <ProspectsList rows={rows} manage={manage} canRun={can(staff, "prospects.run")} canSettings={can(staff, "settings.manage")} settings={settings} unmapped={unmapped} />
    </AdminPage>
  );
}
