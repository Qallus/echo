import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { NotificationsList, type NoteRow } from "./notifications-list";

export const metadata = { title: "Notifications · Redial" };

// Everything the bell has told you, in the shared list layout.
export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, type, title, body, url, read_at, created_at")
    .eq("user_id", user.id).eq("show_in_app", true).order("created_at", { ascending: false }).limit(300);
  return (
    <div className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="max-md:sr-only">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">Recordings ready, calls, texts and anything else Redial told you.</p>
      </div>
      <NotificationsList userId={user.id} rows={(data ?? []) as NoteRow[]} />
    </div>
  );
}
