import { CalendarView } from "@/components/calendar/calendar-view";
import { listCalendarEvents, listWorkspaces } from "@/lib/data";

export const metadata = { title: "Calendar · Echo" };

// Appointments, events and deadlines, including ones added from recordings.
export default async function CalendarPage() {
  const now = Date.now();
  const [events, workspaces] = await Promise.all([
    listCalendarEvents(new Date(now - 180 * 86400000).toISOString(), new Date(now + 400 * 86400000).toISOString()),
    listWorkspaces(),
  ]);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">Appointments, events and deadlines, including dates picked up from your recordings.</p>
      </div>
      <CalendarView events={events} workspaces={workspaces} />
    </div>
  );
}
