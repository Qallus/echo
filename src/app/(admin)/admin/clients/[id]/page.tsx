import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, Phone } from "lucide-react";
import { Section } from "@/components/admin/admin-ui";
import { ActivityFeed } from "@/components/admin/crm/activity-feed";
import { DealRows, Detail, ownerName } from "@/components/admin/crm/crm-ui";
import { AddContactButton, AddDealButton, CompanyActions } from "@/components/admin/crm/record-actions";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, getCompany, listActivities, listCompanies, listContacts, listDeals } from "@/lib/crm/data";
import { COMPANY_STATUSES, contactName } from "@/lib/crm/types";
import { isUuid } from "@/lib/data";

export const metadata = { title: "Client · Admin · Echo" };

const safeUrl = (u: string | null) => (u ? (/^https?:\/\//i.test(u) ? u : `https://${u}`) : null);

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("crm.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const company = await getCompany(id);
  if (!company) notFound();
  const manage = can(staff, "crm.manage");
  const [deals, companies, allContacts, people] = await Promise.all([listDeals({ companyId: id }), listCompanies(), listContacts(), crmStaff()]);
  const contacts = allContacts.filter((c) => c.company_id === id);
  const activities = await listActivities({ companyId: id, contactIds: contacts.map((c) => c.id), dealIds: deals.map((d) => d.id) });
  const companyRefs = companies.map(({ id, name }) => ({ id, name }));
  const related = Object.fromEntries([
    ...deals.map((d) => [d.id, { label: d.title, href: `/admin/pipeline/${d.id}` }] as const),
    ...contacts.map((c) => [c.id, { label: contactName(c), href: `/admin/contacts/${c.id}` }] as const),
  ]);
  const website = safeUrl(company.website);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/clients" />}><ArrowLeft /> Clients</Button>

      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-xl border bg-muted"><Building2 className="size-6 text-muted-foreground" /></span>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{company.name}</h1>
          {company.industry && <p className="text-sm text-muted-foreground">{company.industry}</p>}
          <div className="flex flex-wrap gap-1 pt-1">
            <Badge variant={company.status === "client" ? "default" : "outline"}>{COMPANY_STATUSES.find((s) => s.id === company.status)?.label}</Badge>
            {company.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
          </div>
        </div>
        {manage && <CompanyActions company={company} staff={people} />}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8">
          <Section title="Details">
            <dl className="grid grid-cols-2 gap-4 rounded-xl border p-4 lg:grid-cols-1">
              <Detail label="Website">{website && <a href={website} target="_blank" rel="noreferrer" className="hover:underline">{company.website}</a>}</Detail>
              <Detail label="Email">{company.email && <a href={`mailto:${company.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="size-3" />{company.email}</a>}</Detail>
              <Detail label="Phone">{company.phone && <a href={`tel:${company.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="size-3" />{company.phone}</a>}</Detail>
              <Detail label="Owner">{ownerName(people, company.owner_id)}</Detail>
              <Detail label="Address">{company.address}</Detail>
            </dl>
            {company.notes && <p className="rounded-xl border p-4 text-sm whitespace-pre-wrap">{company.notes}</p>}
          </Section>

          <Section title="Contacts" actions={manage && <AddContactButton companies={companyRefs} staff={people} companyId={id} />}>
            {contacts.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No contacts yet.</p> : (
              <ul className="divide-y rounded-xl border">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/contacts/${c.id}`} className="flex items-center gap-2.5 p-3 hover:bg-muted/40">
                      <UserAvatar name={contactName(c)} email={c.email ?? ""} src={null} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{contactName(c)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{c.title ?? c.email ?? ""}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-8 lg:col-span-2">
          <Section title="Deals" actions={manage && <AddDealButton companies={companyRefs} contacts={allContacts} staff={people} defaults={{ company_id: id }} />}>
            <DealRows deals={deals} />
          </Section>
          <Section title="Activity" description="Includes activity on this client's contacts and deals.">
            <ActivityFeed activities={activities} staff={people} target={{ company_id: id }} related={related} readOnly={!manage} />
          </Section>
        </div>
      </div>
    </div>
  );
}
