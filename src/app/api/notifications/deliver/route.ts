import { NextResponse, type NextRequest } from "next/server";
import type webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailHtml, secretMatches, sendEmail, sendPush, sendSms, siteUrl } from "@/lib/notify/senders";
import { DEFAULT_PREFS, type Preference } from "@/lib/notify/types";

// Called by the database (pg_net trigger on notifications insert) with the
// shared NOTIFY_SECRET. No user session here, so it uses the service-role
// client; it reads the notification by id rather than trusting the body.

type Delivery = { notification_id: string; channel: "email" | "sms" | "push"; target: string | null; status: "sent" | "skipped" | "failed"; detail?: string; provider_id?: string };

// Is "now" inside [start, end) in the user's time zone? Handles overnight ranges.
function inQuietHours(start: string | null, end: string | null, tz: string | null) {
  if (!start || !end) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz || "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const now = parts.slice(0, 5);
  const s = start.slice(0, 5);
  const e = end.slice(0, 5);
  return s <= e ? now >= s && now < e : now >= s || now < e;
}

export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("x-echo-secret"))) return new NextResponse("Forbidden", { status: 403 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return new NextResponse("Bad request", { status: 400 });

  const db = createAdminClient();
  const { data: n } = await db.from("notifications").select("*").eq("id", id).maybeSingle();
  if (!n) return new NextResponse("Not found", { status: 404 });
  // Deliver once, even if the database retries.
  const { count } = await db.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("notification_id", id);
  if (count) return NextResponse.json({ ok: true, duplicate: true });

  const [{ data: pref }, { data: profile }, { data: channels }, { data: user }] = await Promise.all([
    db.from("notification_preferences").select("in_app, email, sms, push").eq("user_id", n.user_id).eq("type", n.type).maybeSingle(),
    db.from("profiles").select("timezone, quiet_start, quiet_end").eq("id", n.user_id).maybeSingle(),
    db.from("notification_channels").select("id, kind, address, push_subscription").eq("user_id", n.user_id).not("verified_at", "is", null),
    db.auth.admin.getUserById(n.user_id),
  ]);
  // Test notifications go to every channel you've set up.
  const want: Preference = n.type === "test" ? { in_app: true, email: true, sms: true, push: true } : (pref ?? DEFAULT_PREFS);
  const quiet = inQuietHours(profile?.quiet_start ?? null, profile?.quiet_end ?? null, profile?.timezone ?? null);
  const link = n.url ? siteUrl(n.url) : siteUrl("/");
  const log: Delivery[] = [];
  const record = (channel: Delivery["channel"], target: string | null, r: { ok: boolean; id?: string; error?: string }) => {
    log.push({ notification_id: id, channel, target, status: r.ok ? "sent" : "failed", detail: r.error, provider_id: r.id });
  };
  const skip = (channel: Delivery["channel"], detail: string) => {
    log.push({ notification_id: id, channel, target: null, status: "skipped", detail });
  };

  const sms = (channels ?? []).filter((c) => c.kind === "sms");
  const push = (channels ?? []).filter((c) => c.kind === "push");
  const emails = [user.user?.email, ...(channels ?? []).filter((c) => c.kind === "email").map((c) => c.address)]
    .filter((e): e is string => !!e)
    .filter((e, i, all) => all.findIndex((x) => x.toLowerCase() === e.toLowerCase()) === i);

  const jobs: Promise<void>[] = [];

  if (!want.email) skip("email", "Turned off for this event");
  else for (const to of emails) {
    jobs.push(sendEmail(to, n.title, emailHtml({ title: n.title, body: n.body, url: link }), `${n.title}\n\n${n.body ?? ""}\n\n${link}`).then((r) => record("email", to, r)));
  }

  if (!want.sms) skip("sms", "Turned off for this event");
  else if (!sms.length) skip("sms", "No verified phone number");
  else if (quiet) skip("sms", "Quiet hours");
  else for (const c of sms) {
    jobs.push(sendSms(c.address, `Echo: ${n.title}\n${link}\nReply STOP to opt out.`).then((r) => record("sms", c.address, r)));
  }

  if (!want.push) skip("push", "Turned off for this event");
  else if (!push.length) skip("push", "No devices with push enabled");
  else if (quiet) skip("push", "Quiet hours");
  else for (const c of push) {
    jobs.push(sendPush(c.push_subscription as webpush.PushSubscription, { title: n.title, body: n.body, url: n.url }).then(async (r) => {
      record("push", "device", r);
      if (r.gone) await db.from("notification_channels").delete().eq("id", c.id); // unsubscribed browser
    }));
  }

  await Promise.all(jobs);
  if (log.length) await db.from("notification_deliveries").insert(log);
  return NextResponse.json({ ok: true, deliveries: log.length });
}
