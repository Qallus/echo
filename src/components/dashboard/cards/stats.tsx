"use client";

import Link from "next/link";
import { CARDS } from "@/lib/dashboard/cards";
import type { CardType } from "@/lib/dashboard/layout";
import type { DashboardData } from "@/lib/dashboard/data";
import { Empty, Frame, MINT, SKY, Spark, Stat } from "../kit";

// The stat cards: one number each, its change since last month, and a
// sparkline where there's a daily series. Calls and texts need a Redial line.

const n = (v: number) => v.toLocaleString();

export function StatCard({ type, data }: { type: CardType; data: DashboardData }) {
  const meta = CARDS[type];
  const c = data.calls;
  const noLine = (
    <Frame title={meta.title} icon={meta.icon}>
      <Empty action={<Link href="/setup" className="text-xs underline">Set up Redial</Link>}>Needs a Redial line.</Empty>
    </Frame>
  );
  switch (type) {
    case "stat_calls":
      return c ? <Stat label="Calls this month" icon={meta.icon} value={n(c.total.now)} count={c.total} href="/calls?tab=phone"
        chips={[{ label: "In", value: c.inbound.now }, { label: "Out", value: c.outbound.now }, { label: "Missed", value: c.missed.now }, { label: "Monitored", value: c.monitored.now }]}
        spark={<Spark points={c.series} color={SKY} />} /> : noLine;
    case "stat_outbound":
      return c ? <Stat label="Outbound" icon={meta.icon} value={n(c.outbound.now)} count={c.outbound} href="/calls?tab=phone" spark={<Spark points={c.series} field="b" color={MINT} />} /> : noLine;
    case "stat_inbound":
      return c ? <Stat label="Inbound" icon={meta.icon} value={n(c.inbound.now)} count={c.inbound} href="/calls?tab=phone" spark={<Spark points={c.series} color={SKY} />} /> : noLine;
    case "stat_missed":
      return c ? <Stat label="Missed" icon={meta.icon} value={n(c.missed.now)} count={c.missed} href="/calls?tab=callbacks" tone={c.missed.now ? "warn" : undefined} /> : noLine;
    case "stat_monitored":
      return c ? <Stat label="Monitored by your AI" icon={meta.icon} value={n(c.monitored.now)} count={c.monitored} href="/calls?tab=assistant" /> : noLine;
    case "stat_alerts":
      return c ? <Stat label="Scam alerts" icon={meta.icon} value={n(c.alerts.now)} count={c.alerts} href="/calls?tab=protection" tone={c.alerts.now ? "warn" : undefined} /> : noLine;
    case "stat_recordings":
      return <Stat label="Recordings" icon={meta.icon} value={n(data.recordings.count.now)} count={data.recordings.count} href="/library/all"
        chips={[{ label: "Min", value: data.recordings.minutes.now }]} />;
    case "stat_sms": {
      const t = data.texts;
      if (!t) return data.hasLine ? <Stat label="SMS" icon={meta.icon} value="—" hint="Turns on with SMS" href="/sms" /> : noLine;
      return <Stat label="Texts this month" icon={meta.icon} value={n(t.sent.now + t.received.now)} count={{ now: t.sent.now + t.received.now, last: t.sent.last + t.received.last }} href="/sms"
        chips={[{ label: "Sent", value: t.sent.now }, { label: "Got", value: t.received.now }, ...(t.left != null ? [{ label: "Left", value: t.left }] : [])]}
        tone={t.left != null && t.allowance ? (t.left / t.allowance < 0.1 ? "warn" : undefined) : undefined}
        spark={<Spark points={t.series} color={MINT} />} />;
    }
    case "stat_bookings":
      return <Stat label="Bookings" icon={meta.icon} value={n(data.calendar.bookings.now)} count={data.calendar.bookings} href="/calendar" />;
    case "stat_calendar":
      return <Stat label="Next 7 days" icon={meta.icon} value={n(data.calendar.week)} hint="events and deadlines" href="/calendar" />;
    case "stat_notifications":
      return <Stat label="Unread notifications" icon={meta.icon} value={n(data.notifications.unread)} hint={data.notifications.unread ? "Tap to read" : "All caught up"} href="/notifications" />;
    case "stat_messages":
      return data.messages ? <Stat label="Unread messages" icon={meta.icon} value={n(data.messages.unread)} hint="Live Agents" href="/messages" />
        : <Stat label="Messages" icon={meta.icon} value="—" hint="Live Agents" href="/messages" />;
    case "stat_emails":
      return data.emails ? <Stat label="Emails sent" icon={meta.icon} value={n(data.emails.now)} count={data.emails} href="/email" />
        : <Stat label="Emails" icon={meta.icon} value="—" hint="Turns on with Emails" href="/email" />;
    case "stat_files":
      return <Stat label="Files" icon={meta.icon} value={n(data.files.live)} href="/library/all"
        chips={[{ label: "Archived", value: data.files.archived }, { label: "Trash", value: data.files.trash }]} />;
    default:
      return null;
  }
}
