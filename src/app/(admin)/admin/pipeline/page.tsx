import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { PipelineBoard } from "@/components/admin/crm/pipeline-board";
import { can, requireStaff } from "@/lib/admin/guard";
import { money } from "@/lib/billing/catalog";
import { crmStaff, listCompanies, listContacts, listDeals, openTasks } from "@/lib/crm/data";
import { pipelineStats } from "@/lib/crm/stats";
import { contactName, formatDay, isOverdue } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pipeline · Admin · Echo" };

// Qallus's sales pipeline for Echo: deals by stage, plus open follow-up tasks.
export default async function PipelinePage() {
  const staff = await requireStaff("crm.view");
  const [deals, companies, contacts, people, tasks] = await Promise.all([listDeals(), listCompanies(), listContacts(), crmStaff(), openTasks()]);
  const stats = pipelineStats(deals, tasks);

  // Where each task lives, for its link.
  const names = new Map<string, { label: string; href: string }>([
    ...deals.map((d) => [d.id, { label: d.title, href: `/admin/pipeline/${d.id}` }] as const),
    ...contacts.map((c) => [c.id, { label: contactName(c), href: `/admin/contacts/${c.id}` }] as const),
    ...companies.map((c) => [c.id, { label: c.name, href: `/admin/clients/${c.id}` }] as const),
  ]);

  return (
    <AdminPage title="Pipeline" description="Echo sales: drag deals between stages.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open pipeline" value={money(stats.openValue)} hint={`${stats.openCount} open deals`} />
        <StatCard label="Won this month" value={money(stats.wonMonthValue)} hint={`${stats.wonMonthCount} deals`} />
        <StatCard label="Win rate (90 days)" value={stats.winRate == null ? "—" : `${Math.round(stats.winRate * 100)}%`} hint="Won ÷ closed" />
        <StatCard label="Overdue follow-ups" value={stats.overdue} hint="Next steps and tasks past due" />
      </div>

      <PipelineBoard deals={deals} companies={companies.map(({ id, name }) => ({ id, name }))} contacts={contacts} staff={people} readOnly={!can(staff, "crm.manage")} />

      {tasks.length > 0 && (
        <Section title="Open tasks" description="Tick them off on the record they belong to.">
          <ul className="divide-y rounded-xl border text-sm">
            {tasks.map((t) => {
              const where = names.get(t.deal_id ?? t.contact_id ?? t.company_id ?? "");
              const due = t.due_at?.slice(0, 10) ?? null;
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                  <span className="min-w-0 flex-1">{t.body}</span>
                  {where && <Link href={where.href} className="text-muted-foreground hover:underline">{where.label}</Link>}
                  <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", isOverdue(due) && "font-medium text-destructive")}>
                    <CalendarClock className="size-3" />{due ? formatDay(due) : "No date"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </AdminPage>
  );
}
