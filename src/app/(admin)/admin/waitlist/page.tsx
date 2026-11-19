import Link from "next/link";
import { AdminPage, StatCard } from "@/components/admin/admin-ui";
import { can, requireStaff } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { ExportCsv } from "./waitlist-controls";
import { WaitlistList } from "./waitlist-list";

export const metadata = { title: "App waitlist · Admin · Redial" };

export type Entry = {
  id: string; first_name: string; last_name: string; email: string; phone: string; platforms: string[]; products: string[];
  account_type: string; company: string | null; team_size: string | null; use_case: string | null; details: string | null; questions: string | null;
  consent_sms: boolean; consent_call: boolean; sms_frequency: string; update_topics: string[]; status: string; source_page: string | null; contact_id: string | null; created_at: string;
};

// People waiting for the mobile apps, from the "Get notified" form on the
// public site. Each one is also a CRM lead (source "App waitlist").
export default async function WaitlistPage() {
  const staff = await requireStaff("comms.view");
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_waitlist").select("*").order("created_at", { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  const all = (data ?? []) as Entry[];
  const manage = can(staff, "comms.manage");

  return (
    <AdminPage title="App waitlist" description="People who asked to hear when the iPhone and Android apps are ready." actions={<ExportCsv rows={all} />}>
      <div className="stat-row grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="On the list" value={all.length} />
        <StatCard label="iPhone" value={all.filter((e) => e.platforms.includes("ios")).length} />
        <StatCard label="Android" value={all.filter((e) => e.platforms.includes("android")).length} />
        <StatCard label="OK to text / call" value={`${all.filter((e) => e.consent_sms).length} / ${all.filter((e) => e.consent_call).length}`} />
      </div>

      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Reaching them</p>
        <p className="mt-1">
          Everyone here is also a lead with source <span className="font-medium text-foreground">App waitlist</span> and tags like <code>app-ios</code>, <code>app-android</code>, <code>wants-redial</code> and <code>business</code>.
          For an email or text drip, add a rule in <Link href="/admin/automation" className="underline">Automation</Link>: &ldquo;A lead is added&rdquo;, where Contact source is App waitlist (add a tag condition to target one app), with delays between steps.
          Only text or call people marked OK to text or OK to call, no more often than the frequency they chose, and only about the topics they picked (shown on each person).
        </p>
      </div>

      <WaitlistList rows={all} manage={manage} />
    </AdminPage>
  );
}
