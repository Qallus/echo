import { AgentTabs } from "@/components/live-agents/agent-tabs";
import { MyAgentsList } from "@/components/live-agents/people-lists";
import { requireUser } from "@/lib/data";
import { myHiredAgents } from "@/lib/live-agents/my-agents";

export const metadata = { title: "My Live Agents · Redial" };

// The Live Agents your workspaces hired: who's working now, booked, offered
// or worked before. Message any of them from here.
export default async function MyLiveAgentsPage() {
  await requireUser();
  const rows = await myHiredAgents();
  return (
    <div className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="max-md:sr-only">
        <h1 className="text-2xl font-semibold tracking-tight">My Live Agents</h1>
        <p className="text-sm text-muted-foreground">The people you&apos;ve hired to answer your calls. Message them, see where they are and when they start.</p>
      </div>
      <AgentTabs />
      <MyAgentsList rows={rows} />
    </div>
  );
}
