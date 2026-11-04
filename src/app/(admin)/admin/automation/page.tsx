import Link from "next/link";
import { Mail } from "lucide-react";
import { AdminPage, Section } from "@/components/admin/admin-ui";
import { RulesPanel, type Records } from "@/components/admin/automation/rules-panel";
import { can, requireStaff } from "@/lib/admin/guard";
import type { Rule, RuleRun } from "@/lib/automation/rules";
import { secret } from "@/lib/secrets";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Automation · Admin · Echo" };

// Rules: when something happens, if it matches, do these things. Database
// triggers queue each run; the scheduled job (/api/cron/comms) carries it out.
export default async function AutomationPage() {
  const staff = await requireStaff("comms.view");
  const supabase = await createClient();
  const [rules, runs, templates, people, deals, leads, bookings, messages, emailAutos, cron] = await Promise.all([
    supabase.from("automation_rules").select("*").order("created_at"),
    supabase.from("automation_rule_runs").select("id, rule_id, status, detail, results, run_at, created_at, deal_id, contact_id, booking_id, message_id")
      .order("created_at", { ascending: false }).limit(50),
    supabase.from("email_templates").select("id, name").order("name"),
    supabase.rpc("crm_staff"),
    supabase.from("crm_deals").select("id, title").order("updated_at", { ascending: false }).limit(50),
    supabase.from("crm_contacts").select("id, first_name, last_name").order("created_at", { ascending: false }).limit(50),
    supabase.from("bookings").select("id, title, starts_at").order("starts_at", { ascending: false }).limit(50),
    supabase.from("inbox_messages").select("id, subject, from_email").order("created_at", { ascending: false }).limit(50),
    supabase.from("email_automations").select("id", { count: "exact", head: true }).eq("enabled", true),
    secret("CRON_SECRET"),
  ]);
  if (rules.error) throw new Error(rules.error.message);
  const records: Records = {
    deal: (deals.data ?? []).map((d) => ({ id: d.id, label: d.title })),
    contact: (leads.data ?? []).map((c) => ({ id: c.id, label: [c.first_name, c.last_name].filter(Boolean).join(" ") })),
    booking: (bookings.data ?? []).map((b) => ({ id: b.id, label: `${b.title} · ${b.starts_at.slice(0, 10)}` })),
    message: (messages.data ?? []).map((m) => ({ id: m.id, label: m.subject || m.from_email || "Message" })),
  };

  return (
    <AdminPage title="Automation" description="When something happens, check the details, then send, assign, create or notify — automatically.">
      {!cron && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Rules queue up but won&apos;t run until the scheduled job is set up: add a Cron secret in <Link href="/admin/settings?tab=integrations" className="underline">Settings → Integrations</Link> and the Coolify scheduled task.
        </p>
      )}
      <RulesPanel rules={(rules.data ?? []) as Rule[]} runs={(runs.data ?? []) as RuleRun[]} templates={templates.data ?? []}
        people={((people.data ?? []) as { user_id: string; name: string }[]).map((p) => ({ id: p.user_id, name: p.name }))}
        records={records} readOnly={!can(staff, "comms.manage")} />
      <Section title="Email automations" description="Simple “send this template when…” automations live with the email templates.">
        <Link href="/admin/communications?tab=email" className="flex items-center gap-3 rounded-xl border p-4 text-sm hover:bg-muted/50">
          <Mail className="size-4 text-muted-foreground" />
          <span className="flex-1">{emailAutos.count ?? 0} email automation{emailAutos.count === 1 ? "" : "s"} on</span>
          <span className="text-muted-foreground">Communications → Email → Automations</span>
        </Link>
      </Section>
    </AdminPage>
  );
}
