import { AgentTabs } from "@/components/live-agents/agent-tabs";
import { MyClientsList } from "@/components/live-agents/people-lists";
import { requireUser } from "@/lib/data";
import { myClients } from "@/lib/live-agents/my-agents";

export const metadata = { title: "My clients · Agent Desk · Redial" };

// For Live Agents: the businesses you work for, with Message on each.
export default async function AgentClientsPage() {
  await requireUser();
  const rows = await myClients();
  return (
    <div className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="max-md:sr-only">
        <h1 className="text-2xl font-semibold tracking-tight">My clients</h1>
        <p className="text-sm text-muted-foreground">Businesses you work for or have offers from. Contact details stay private; message them here.</p>
      </div>
      <AgentTabs />
      <MyClientsList rows={rows} />
    </div>
  );
}
