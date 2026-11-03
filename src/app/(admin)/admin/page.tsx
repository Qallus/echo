import Link from "next/link";
import { AlertTriangle, AudioLines, Briefcase, CircleCheck, CreditCard, Mail, Repeat, Users } from "lucide-react";
import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { can, requireStaff } from "@/lib/admin/guard";
import { money } from "@/lib/billing/catalog";
import { loadCatalog } from "@/lib/billing/catalog-server";
import { mrr } from "@/lib/billing/metrics";
import { createClient } from "@/lib/supabase/server";

type Dashboard = {
  users: number; users_30d: number; business_workspaces: number; recordings: number; recordings_month: number; minutes_month: number;
  failed_transcriptions_7d: number; failed_deliveries_24h: number;
  subscriptions: { status: string; items: { price_key: string; quantity: number }[] }[] | null;
  orders_month: { count: number; total: number } | null;
};
type Attention = { kind: "transcription" | "delivery" | "payment"; title: string; detail: string | null; at: string; target_id: string };
type AuditRow = { id: number; action: string; target_type: string | null; created_at: string; actor: string | null };

const ATTENTION_ICON = { transcription: AudioLines, delivery: Mail, payment: CreditCard };

export default async function AdminDashboardPage() {
  const staff = await requireStaff("dashboard.view");
  const supabase = await createClient();
  const [dash, attention, audit] = await Promise.all([
    loadCatalog().then(() => supabase.rpc("admin_dashboard")),
    supabase.rpc("admin_attention"),
    can(staff, "audit.view")
      ? supabase.from("admin_audit_log").select("id, action, target_type, created_at, actor").order("created_at", { ascending: false }).limit(8)
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (dash.error) throw new Error(dash.error.message);
  const d = dash.data as Dashboard;
  const items = (attention.data ?? []) as Attention[];
  const billing = d.subscriptions !== null;

  return (
    <AdminPage title="Dashboard" description="How Echo is doing right now.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Users" value={d.users} hint={`+${d.users_30d} in the last 30 days`} />
        <StatCard icon={Briefcase} label="Business workspaces" value={d.business_workspaces} />
        <StatCard icon={AudioLines} label="Recordings this month" value={d.recordings_month} hint={`${d.minutes_month} minutes · ${d.recordings} all time`} />
        {billing ? (
          <StatCard icon={Repeat} label="MRR" value={money(mrr(d.subscriptions!))}
            hint={`${d.subscriptions!.filter((s) => s.status !== "past_due").length} active subscriptions · ${money(d.orders_month?.total ?? 0)} in orders this month`} />
        ) : (
          <StatCard icon={AlertTriangle} label="Failures (7 days)" value={d.failed_transcriptions_7d + d.failed_deliveries_24h} />
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Section title="Needs attention" description="Failed transcriptions and notifications from the last 7 days, and past-due payments.">
          {items.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground"><CircleCheck className="size-4 text-emerald-600" /> Nothing needs attention.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {items.map((a, i) => {
                const Icon = ATTENTION_ICON[a.kind];
                return (
                  <li key={i} className="flex gap-3 p-3 text-sm">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.title}</p>
                      {a.detail && <p className="line-clamp-2 text-xs text-muted-foreground">{a.detail}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground"><LocalDate iso={a.at} short /></span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {audit.data && (
          <Section title="Recent admin activity" actions={<Link href="/admin/settings" className="text-sm text-muted-foreground hover:text-foreground">All</Link>}>
            {(audit.data as AuditRow[]).length === 0 ? (
              <p className="rounded-xl border p-4 text-sm text-muted-foreground">No admin actions yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(audit.data as AuditRow[]).map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <code className="truncate text-xs">{r.action}</code>
                    <span className="shrink-0 text-xs text-muted-foreground"><LocalDate iso={r.created_at} short /></span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>
    </AdminPage>
  );
}
