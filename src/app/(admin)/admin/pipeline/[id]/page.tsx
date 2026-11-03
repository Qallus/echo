import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/admin/admin-ui";
import { ActivityFeed } from "@/components/admin/crm/activity-feed";
import { Detail } from "@/components/admin/crm/crm-ui";
import { DealActions, StageSelect } from "@/components/admin/crm/record-actions";
import { LocalDate } from "@/components/local-date";
import { Button } from "@/components/ui/button";
import { can, requireStaff } from "@/lib/admin/guard";
import { money } from "@/lib/billing/catalog";
import { crmStaff, getDeal, listActivities, listCompanies, listContacts } from "@/lib/crm/data";
import { contactName, formatDay, isOverdue, ownerName } from "@/lib/crm/types";
import { isUuid } from "@/lib/data";
import { cn } from "@/lib/utils";

export const metadata = { title: "Deal · Admin · Echo" };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("crm.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const deal = await getDeal(id);
  if (!deal) notFound();
  const manage = can(staff, "crm.manage");
  const [companies, contacts, people, activities] = await Promise.all([listCompanies(), listContacts(), crmStaff(), listActivities({ dealIds: [id] })]);
  const open = deal.stage !== "won" && deal.stage !== "lost";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/pipeline" />}><ArrowLeft /> Pipeline</Button>

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <StageSelect key={deal.stage} id={deal.id} stage={deal.stage} readOnly={!manage} />
            <span className="text-xl font-semibold tabular-nums">{money(deal.value_cents, deal.currency)}</span>
            {deal.closed_at && <span className="text-sm text-muted-foreground">Closed <LocalDate iso={deal.closed_at} short /></span>}
          </div>
        </div>
        {manage && <DealActions deal={deal} companies={companies.map(({ id, name }) => ({ id, name }))} contacts={contacts} staff={people} />}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Section title="Details">
          <dl className="grid grid-cols-2 gap-4 rounded-xl border p-4 lg:grid-cols-1">
            <Detail label="Client">{deal.company && <Link href={`/admin/clients/${deal.company.id}`} className="hover:underline">{deal.company.name}</Link>}</Detail>
            <Detail label="Contact">{deal.contact && <Link href={`/admin/contacts/${deal.contact.id}`} className="hover:underline">{contactName(deal.contact)}</Link>}</Detail>
            <Detail label="Next step">
              {(deal.next_step || deal.next_step_due) && (
                <span className={cn(open && isOverdue(deal.next_step_due) && "font-medium text-destructive")}>
                  {deal.next_step ?? "Follow up"}{deal.next_step_due ? ` · ${formatDay(deal.next_step_due)}` : ""}
                </span>
              )}
            </Detail>
            <Detail label="Expected close">{deal.expected_close && formatDay(deal.expected_close)}</Detail>
            <Detail label="Owner">{ownerName(people, deal.owner_id)}</Detail>
            <Detail label="Source">{deal.source}</Detail>
            {deal.stage === "lost" && <Detail label="Lost reason">{deal.lost_reason}</Detail>}
            <Detail label="Created"><LocalDate iso={deal.created_at} short /></Detail>
          </dl>
          {deal.notes && <p className="rounded-xl border p-4 text-sm whitespace-pre-wrap">{deal.notes}</p>}
        </Section>

        <div className="lg:col-span-2">
          <Section title="Activity">
            <ActivityFeed activities={activities} staff={people} target={{ deal_id: id }} readOnly={!manage} />
          </Section>
        </div>
      </div>
    </div>
  );
}
