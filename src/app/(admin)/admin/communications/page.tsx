import { AdminPage } from "@/components/admin/admin-ui";
import { EmailPanel } from "@/components/admin/comms/email-panel";
import { InboxPanel } from "@/components/admin/comms/inbox-panel";
import { NotificationsPanel } from "@/components/admin/comms/notifications-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { listDeliveries, listInbox, listSends, listTemplates, listUnsubscribes } from "@/lib/comms/data";
import { listContacts } from "@/lib/crm/data";
import { contactName } from "@/lib/crm/types";

export const metadata = { title: "Communications · Admin · Echo" };

const TABS = ["inbox", "email", "notifications"] as const;

// Email (templates, sending, history), the inbox (contact form and inbound
// email) and the notification delivery log. Texts and calls join next.
export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await requireStaff("comms.view");
  const showNotifications = can(staff, "notifications.view");
  const [{ tab }, inbox, templates, sends, unsubscribes, contacts, deliveries] = await Promise.all([
    searchParams, listInbox(), listTemplates(), listSends(), listUnsubscribes(),
    can(staff, "crm.view") ? listContacts() : Promise.resolve([]),
    showNotifications ? listDeliveries() : Promise.resolve([]),
  ]);
  const initial = TABS.includes(tab as (typeof TABS)[number]) ? tab! : "inbox";
  const readOnly = !can(staff, "comms.manage");
  const unread = inbox.filter((m) => m.status === "new").length;

  return (
    <AdminPage title="Communications" description="Your inbox, email templates and sending, and every notification Echo delivers." className="max-w-[96rem]">
      <Tabs defaultValue={initial}>
        <TabsList variant="line">
          <TabsTrigger value="inbox">Inbox{unread > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unread}</span>}</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          {showNotifications && <TabsTrigger value="notifications">Notifications</TabsTrigger>}
        </TabsList>
        <TabsContent value="inbox" className="pt-6"><InboxPanel messages={inbox} readOnly={readOnly} canCrm={can(staff, "crm.manage")} /></TabsContent>
        <TabsContent value="email" className="pt-6">
          <EmailPanel templates={templates} sends={sends} unsubscribes={unsubscribes} readOnly={readOnly}
            people={contacts.map((c) => ({ id: c.id, name: contactName(c), email: c.email }))} />
        </TabsContent>
        {showNotifications && <TabsContent value="notifications" className="pt-6"><NotificationsPanel deliveries={deliveries} /></TabsContent>}
      </Tabs>
    </AdminPage>
  );
}
