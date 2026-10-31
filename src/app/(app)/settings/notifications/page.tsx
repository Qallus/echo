import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFS, NOTIFICATION_TYPES, type Preference } from "@/lib/notify/types";
import { ChannelList, PreferenceGrid, PushCard, QuietHours, TestButton } from "./notification-settings";

export const metadata = { title: "Notifications · Settings · Echo" };

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: channels }, { data: prefs }, { data: profile }] = await Promise.all([
    supabase.from("notification_channels").select("id, kind, address, label, verified_at, code_expires_at, created_at").order("created_at"),
    supabase.from("notification_preferences").select("type, in_app, email, sms, push"),
    supabase.from("profiles").select("quiet_start, quiet_end, timezone").eq("id", user.id).maybeSingle(),
  ]);
  const prefMap: Record<string, Preference> = Object.fromEntries(
    NOTIFICATION_TYPES.map((t) => {
      const row = prefs?.find((p) => p.type === t.type);
      return [t.type, row ? { in_app: row.in_app, email: row.email, sms: row.sms, push: row.push } : DEFAULT_PREFS];
    }),
  );
  const list = channels ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Where to reach you</CardTitle>
          <CardDescription>Echo emails your account address. Add more addresses or a phone number for texts; each needs a quick code to confirm it&apos;s yours.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ChannelList kind="email" accountEmail={user.email} channels={list.filter((c) => c.kind === "email")} />
          <ChannelList kind="sms" channels={list.filter((c) => c.kind === "sms")} />
        </CardContent>
      </Card>

      <PushCard devices={list.filter((c) => c.kind === "push").map((c) => ({ id: c.id, address: c.address, label: c.label }))}
        vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />

      <Card>
        <CardHeader>
          <CardTitle>What to notify you about</CardTitle>
          <CardDescription>Choose how each kind of update reaches you. Changes save as you go.</CardDescription>
        </CardHeader>
        <CardContent><PreferenceGrid prefs={prefMap} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quiet hours</CardTitle>
          <CardDescription>Texts and push notifications wait until quiet hours end. The bell and email still arrive.{profile?.timezone ? ` Times are in ${profile.timezone.replaceAll("_", " ")}.` : " Set your time zone on the Profile tab, otherwise times are UTC."}</CardDescription>
        </CardHeader>
        <CardContent><QuietHours start={profile?.quiet_start?.slice(0, 5) ?? ""} end={profile?.quiet_end?.slice(0, 5) ?? ""} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Try it</CardTitle>
          <CardDescription>Sends a test to the bell and to every verified email, phone and device.</CardDescription>
        </CardHeader>
        <CardContent><TestButton /></CardContent>
      </Card>
    </div>
  );
}
