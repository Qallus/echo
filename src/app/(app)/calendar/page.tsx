import { CalendarView } from "@/components/calendar/calendar-view";
import { GoogleSync } from "@/components/calendar/google-sync";
import { getUser, listCalendarEvents, listWorkspaces } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Calendar · Redial" };

// Six months back to about a year ahead.
function range() {
  const now = Date.now();
  return [new Date(now - 180 * 86400000).toISOString(), new Date(now + 400 * 86400000).toISOString()] as const;
}

// Appointments, events and deadlines, including ones added from recordings.
export default async function CalendarPage() {
  const [from, to] = range();
  const user = await getUser();
  const supabase = await createClient();
  const [events, workspaces, { data: google }] = await Promise.all([
    listCalendarEvents(from, to),
    listWorkspaces(),
    supabase.from("account_connections").select("account_email, status").eq("user_id", user?.id ?? "").eq("provider", "google").maybeSingle(),
  ]);
  return (
    <div className="w-full space-y-6 py-8 px-4 sm:px-6 lg:px-8 2xl:px-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">Appointments, events and deadlines, including dates picked up from your recordings.</p>
        <GoogleSync connected={google?.status === "active"} email={google?.account_email ?? null} />
      </div>
      <CalendarView events={events} workspaces={workspaces} />
    </div>
  );
}
