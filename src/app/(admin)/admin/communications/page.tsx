import { AdminPage } from "@/components/admin/admin-ui";
import { EmailPanel } from "@/components/admin/comms/email-panel";
import { CallsPanel } from "@/components/admin/comms/calls-panel";
import { PhoneCenter } from "@/components/redial/phone-center";
import { phoneCenterData } from "@/lib/redial/data";
import { InboxPanel } from "@/components/admin/comms/inbox-panel";
import { NotificationsPanel } from "@/components/admin/comms/notifications-panel";
import { TextsPanel } from "@/components/admin/comms/texts-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { listAudiences, listAutomations, listCalls, listCampaigns, listDeliveries, listInbox, listOptOuts, listScheduled, listSends, listTemplates, listTexts, listUnsubscribes } from "@/lib/comms/data";
import { callsReady, phoneNumber, textsReady } from "@/lib/comms/twilio";
import { secret } from "@/lib/secrets";
import { listContacts } from "@/lib/crm/data";
import { contactName } from "@/lib/crm/types";

export const metadata = { title: "Communications · Admin · Redial" };

const TABS = ["calls", "texts", "inbox", "email", "notifications"] as const;

// The inbox (contact form and inbound email), texts and calls on Echo's
// number, email (templates, automations, sending, history) and the
// notification delivery log.
export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await requireStaff("comms.view");
  const showNotifications = can(staff, "notifications.view");
  const [{ tab }, inbox, templates, sends, unsubscribes, contacts, deliveries, texts, calls, optOuts, automations, campaigns, audiences, scheduled] = await Promise.all([
    searchParams, listInbox(), listTemplates(), listSends(), listUnsubscribes(),
    can(staff, "crm.view") ? listContacts() : Promise.resolve([]),
    showNotifications ? listDeliveries() : Promise.resolve([]),
    listTexts(), listCalls(), listOptOuts(), listAutomations(), listCampaigns(), listAudiences(), listScheduled(),
  ]);
  const knownTags = [...new Set(contacts.flatMap((c) => c.tags ?? []))].sort();
  const [canText, canCall, number, cronSecret, phone] = await Promise.all([textsReady(), callsReady(), phoneNumber(), secret("CRON_SECRET"), phoneCenterData()]);
  const phonePeople = contacts.map((c) => ({ id: c.id, name: contactName(c), phone: c.phone }));
  const unreadTexts = texts.filter((t) => t.direction === "inbound" && !t.read_at).length;
  const initial = TABS.includes(tab as (typeof TABS)[number]) ? tab! : "calls";
  const readOnly = !can(staff, "comms.manage");
  const unread = inbox.filter((m) => m.status === "new").length;

  return (
    <AdminPage title="Communications" description="Your inbox, texts and calls, email and automations, and every notification Redial delivers.">
      <Tabs defaultValue={initial}>
        <TabsList variant="line">
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="texts">Texts (SMS){unreadTexts > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unreadTexts}</span>}</TabsTrigger>
          <TabsTrigger value="inbox">Inbox{unread > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unread}</span>}</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          {showNotifications && <TabsTrigger value="notifications">Notifications</TabsTrigger>}
        </TabsList>
        <TabsContent value="inbox" className="pt-6"><InboxPanel messages={inbox} readOnly={readOnly} canCrm={can(staff, "crm.manage")} /></TabsContent>
        <TabsContent value="texts" className="pt-6"><TextsPanel texts={texts} people={phonePeople} optOuts={optOuts} ready={canText} readOnly={readOnly} scheduled={scheduled.filter((x) => x.channel === "sms")} cronReady={Boolean(cronSecret)} /></TabsContent>
        <TabsContent value="calls" className="space-y-8 pt-6">
          {phone.lines.length > 0
            ? <PhoneCenter {...phone} canCrm={can(staff, "crm.manage")} />
            : <CallsPanel calls={calls} people={phonePeople} ready={canCall} number={number} readOnly={readOnly} />}
          {phone.lines.length > 0 && calls.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Older calls on the admin browser phone</h2>
              <CallsPanel calls={calls} people={phonePeople} ready={canCall} number={number} readOnly={readOnly} />
            </section>
          )}
        </TabsContent>
        <TabsContent value="email" className="pt-6">
          <EmailPanel scheduled={scheduled.filter((x) => x.channel === "email")} templates={templates} sends={sends} campaigns={campaigns} audiences={audiences} unsubscribes={unsubscribes} readOnly={readOnly} automations={automations} cronReady={Boolean(cronSecret)}
            knownTags={knownTags} canCustomers={can(staff, "users.view")}
            people={contacts.map((c) => ({ id: c.id, name: contactName(c), email: c.email }))} />
        </TabsContent>
        {showNotifications && <TabsContent value="notifications" className="pt-6"><NotificationsPanel deliveries={deliveries} /></TabsContent>}
      </Tabs>
    </AdminPage>
  );
}
