import Link from "next/link";
import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { can, requireStaff } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ExportCsv, StatusSelect } from "./waitlist-controls";

export const metadata = { title: "App waitlist · Admin · Echo" };

export type Entry = {
  id: string; first_name: string; last_name: string; email: string; phone: string; platforms: string[]; products: string[];
  account_type: string; company: string | null; team_size: string | null; use_case: string | null; details: string | null; questions: string | null;
  consent_sms: boolean; consent_call: boolean; sms_frequency: string; update_topics: string[]; status: string; source_page: string | null; contact_id: string | null; created_at: string;
};

const FILTERS = [
  { id: "all", label: "Everyone" }, { id: "ios", label: "iPhone" }, { id: "android", label: "Android" },
  { id: "business", label: "Business" }, { id: "personal", label: "Personal" }, { id: "sms", label: "OK to text" }, { id: "call", label: "OK to call" },
];
const FREQ: Record<string, string> = { major: "big news only", monthly: "monthly", weekly: "weekly", all: "every update" };
const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const apps = (e: Entry) => e.platforms.map((p) => (p === "ios" ? "iPhone" : "Android")).join(" + ");

// People waiting for the mobile apps, from the "Get notified" form on the
// public site. Each one is also a CRM lead (source "App waitlist").
export default async function WaitlistPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const staff = await requireStaff("comms.view");
  const { show = "all" } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_waitlist").select("*").order("created_at", { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  const all = (data ?? []) as Entry[];
  const rows = all.filter((e) =>
    show === "ios" || show === "android" ? e.platforms.includes(show)
    : show === "business" || show === "personal" ? e.account_type === show
    : show === "sms" ? e.consent_sms : show === "call" ? e.consent_call : true);
  const manage = can(staff, "comms.manage");

  return (
    <AdminPage title="App waitlist" description="People who asked to hear when the iPhone and Android apps are ready." actions={<ExportCsv rows={rows} />}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      <Section title={`${rows.length} ${rows.length === 1 ? "person" : "people"}`}>
        <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1 text-xs" aria-label="Filter">
          {FILTERS.map((f) => (
            <Link key={f.id} href={f.id === "all" ? "/admin/waitlist" : `/admin/waitlist?show=${f.id}`}
              className={cn("rounded-md px-2.5 py-1 font-medium", show === f.id ? "bg-card shadow-sm" : "text-muted-foreground")}>{f.label}</Link>
          ))}
        </nav>
        {rows.length === 0 ? <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Nobody yet.</p> : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {rows.map((e) => (
              <li key={e.id} className="space-y-1.5 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="font-medium">
                    {e.contact_id ? <Link href={`/admin/contacts/${e.contact_id}`} className="hover:underline">{e.first_name} {e.last_name}</Link> : `${e.first_name} ${e.last_name}`}
                  </p>
                  <span className="text-xs text-muted-foreground">{apps(e)} · {e.account_type}{e.company ? ` · ${e.company}` : ""}{e.team_size ? ` (${e.team_size})` : ""}</span>
                  <span className="flex-1" />
                  <span className="text-xs text-muted-foreground"><LocalDate iso={e.created_at} short /></span>
                  {manage ? <StatusSelect id={e.id} status={e.status} /> : <span className="text-xs capitalize">{e.status}</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  <a href={`mailto:${e.email}`} className="hover:underline">{e.email}</a> · <a href={`tel:${e.phone}`} className="hover:underline">{pretty(e.phone)}</a>
                  {" · "}{e.consent_sms ? `OK to text (${FREQ[e.sms_frequency] ?? e.sms_frequency})` : "No texts"} · {e.consent_call ? "OK to call" : "No calls"}
                  {e.update_topics.length > 0 && ` · wants ${e.update_topics.join(", ")}`}
                  {e.products.length > 0 && ` · wants ${e.products.map((p) => (p === "echo" ? "Echo" : "Redial")).join(" and ")}`}
                  {e.use_case && ` · ${e.use_case}`}
                </p>
                {e.details && <p className="text-sm">{e.details}</p>}
                {e.questions && <p className="rounded-lg bg-muted/60 p-2 text-sm"><span className="text-xs text-muted-foreground">Question: </span>{e.questions}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AdminPage>
  );
}
