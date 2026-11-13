import { InboxShell } from "@/components/live-agents/inbox/inbox-shell";
import { requireUser } from "@/lib/data";
import { listThreads } from "@/lib/live-agents/messages";

export const metadata = { title: "Messages · Redial" };

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const threads = await listThreads();
  if (threads === null) {
    return <p className="m-6 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Messaging is being set up. Check back shortly.</p>;
  }
  return <InboxShell threads={threads}>{children}</InboxShell>;
}
