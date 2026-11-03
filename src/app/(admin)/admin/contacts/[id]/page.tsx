import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, UserRound } from "lucide-react";
import { Section } from "@/components/admin/admin-ui";
import { ActivityFeed } from "@/components/admin/crm/activity-feed";
import { DealRows, Detail, ownerName } from "@/components/admin/crm/crm-ui";
import { AddDealButton, ContactActions } from "@/components/admin/crm/record-actions";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, getContact, listActivities, listCompanies, listContacts, listDeals } from "@/lib/crm/data";
import { contactName } from "@/lib/crm/types";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Contact · Admin · Echo" };

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("crm.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const contact = await getContact(id);
  if (!contact) notFound();
  const manage = can(staff, "crm.manage");
  const supabase = await createClient();
  const [deals, companies, contacts, people, echoUser] = await Promise.all([
    listDeals({ contactId: id }), listCompanies(), listContacts(), crmStaff(),
    contact.email && can(staff, "users.view") ? supabase.rpc("admin_user_by_email", { p_email: contact.email }).then((r) => r.data as string | null) : null,
  ]);
  const activities = await listActivities({ contactIds: [id], dealIds: deals.map((d) => d.id) });
  const companyRefs = companies.map(({ id, name }) => ({ id, name }));
  const related = Object.fromEntries(deals.map((d) => [d.id, { label: d.title, href: `/admin/pipeline/${d.id}` }]));
  const name = contactName(contact);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/contacts" />}><ArrowLeft /> Contacts</Button>

      <div className="flex flex-wrap items-start gap-4">
        <UserAvatar name={name} email={contact.email ?? ""} src={null} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {contact.title}{contact.title && contact.company ? " at " : ""}
            {contact.company && <Link href={`/admin/clients/${contact.company.id}`} className="hover:underline">{contact.company.name}</Link>}
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
            {contact.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
            {echoUser && <Badge className="gap-1"><UserRound className="size-3" /><Link href={`/admin/users/${echoUser}`}>Echo customer</Link></Badge>}
          </div>
        </div>
        {manage && <ContactActions contact={contact} companies={companyRefs} staff={people} />}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Section title="Details">
          <dl className="grid grid-cols-2 gap-4 rounded-xl border p-4 lg:grid-cols-1">
            <Detail label="Email">{contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="size-3" />{contact.email}</a>}</Detail>
            <Detail label="Phone">{contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="size-3" />{contact.phone}</a>}</Detail>
            <Detail label="Owner">{ownerName(people, contact.owner_id)}</Detail>
            <Detail label="Source">{contact.source}</Detail>
          </dl>
          {contact.notes && <p className="rounded-xl border p-4 text-sm whitespace-pre-wrap">{contact.notes}</p>}
        </Section>

        <div className="space-y-8 lg:col-span-2">
          <Section title="Deals" actions={manage && <AddDealButton companies={companyRefs} contacts={contacts} staff={people} defaults={{ contact_id: id, company_id: contact.company_id ?? undefined }} />}>
            <DealRows deals={deals} />
          </Section>
          <Section title="Activity">
            <ActivityFeed activities={activities} staff={people} target={{ contact_id: id }} related={related} readOnly={!manage} />
          </Section>
        </div>
      </div>
    </div>
  );
}
