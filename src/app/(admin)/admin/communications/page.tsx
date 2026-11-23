import { EmailPanel } from "@/components/admin/comms/email-panel";
import { CallsPanel } from "@/components/admin/comms/calls-panel";
import { PhoneCenter } from "@/components/redial/phone-center";
import { phoneCenterData } from "@/lib/redial/data";
import { InboxPanel } from "@/components/admin/comms/inbox-panel";
import { NotificationsPanel } from "@/components/admin/comms/notifications-panel";
import { TextsPanel } from "@/components/admin/comms/texts-panel";
import { CommsTabs, type CommsTab } from "@/components/admin/comms/comms-tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { listAudiences, listAutomations, listCalls, listCampaigns, listDeliveries, listInbox, listOptOuts, listScheduled, listSends, listTemplates, listTexts, listUnsubscribes } from "@/lib/comms/data";
import { callsReady, phoneNumber, textsReady } from "@/lib/comms/twilio";
import { secret } from "@/lib/secrets";
import { listContacts } from "@/lib/crm/data";
import { contactName } from "@/lib/crm/types";

export const metadata = { title: "Communications · Admin · Redial" };

const TABS: CommsTab[] = ["keypad", "recents", "texts", "inbox", "email", "notifications"];

// Laid out like a phone app: the keypad and recent calls, texts, the inbox
// (contact form and inbound email), email (templates, automations, sending,
// history) and the notification delivery log. No page title, to leave the
// screen to the phone on small devices (the heading is for screen readers).
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
  const initial: CommsTab = tab === "calls" ? "keypad" : TABS.includes(tab as CommsTab) && (tab !== "notifications" || showNotifications) ? (tab as CommsTab) : "keypad";
  const unreadCalls = phone.calls.filter((c) => c.direction !== "outbound" && !c.read_at && !c.archived_at && ["message", "completed", "missed", "connected"].includes(c.status)).length;
  const readOnly = !can(staff, "comms.manage");
  const unread = inbox.filter((m) => m.status === "new").length;

  const hasLines = phone.lines.length > 0;
  return (
    <div className="w-full px-4 pt-0 pb-6 sm:px-6 md:py-8 lg:px-8">
      <h1 className="sr-only">Communications</h1>
      <CommsTabs initial={initial} showNotifications={showNotifications} badges={{ recents: unreadCalls, texts: unreadTexts, inbox: unread }}
        panels={{
          calls: (
            <div className="space-y-8">
              {hasLines
                ? <PhoneCenter {...phone} canCrm={can(staff, "crm.manage")} people={phonePeople} />
                : <CallsPanel calls={calls} people={phonePeople} ready={canCall} number={number} readOnly={readOnly} />}
              {hasLines && calls.length > 0 && (
                <CallsPanel calls={calls} people={phonePeople} ready={canCall} number={number} readOnly={readOnly} showPad={false} heading="Older calls on the admin browser phone" />
              )}
            </div>
          ),
          texts: <TextsPanel texts={texts} people={phonePeople} optOuts={optOuts} ready={canText} readOnly={readOnly} scheduled={scheduled.filter((x) => x.channel === "sms")} cronReady={Boolean(cronSecret)} />,
          inbox: <InboxPanel messages={inbox} readOnly={readOnly} canCrm={can(staff, "crm.manage")} />,
          email: (
            <EmailPanel scheduled={scheduled.filter((x) => x.channel === "email")} templates={templates} sends={sends} campaigns={campaigns} audiences={audiences} unsubscribes={unsubscribes} readOnly={readOnly} automations={automations} cronReady={Boolean(cronSecret)}
              knownTags={knownTags} canCustomers={can(staff, "users.view")}
              people={contacts.map((c) => ({ id: c.id, name: contactName(c), email: c.email }))} />
          ),
          notifications: showNotifications ? <NotificationsPanel deliveries={deliveries} /> : undefined,
        }} />
    </div>
  );
}
