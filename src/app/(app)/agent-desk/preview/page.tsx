import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { ProfileView } from "@/components/live-agents/profile-view";
import { myLiveAgent } from "@/lib/live-agents/agent-data";
import { getFees, listSkills } from "@/lib/live-agents/data";
import { AGENT_STATUS } from "@/lib/live-agents/setup";

export const metadata = { title: "Preview your profile · Redial Live Agents" };

// The agent's own profile as businesses will see it, in any status.
export default async function AgentPreviewPage() {
  const agent = await myLiveAgent();
  if (!agent) redirect("/agent-desk");
  const [skills, fees] = await Promise.all([listSkills(), getFees()]);
  const pending = Object.entries(agent.clipStatus).filter(([, s]) => s !== "approved").map(([id]) => id);
  return (
    <>
      <div className="border-b bg-muted/40">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
          <span className="inline-flex items-center gap-2"><Eye className="size-4" /> Preview · {AGENT_STATUS[agent.status].label}: {AGENT_STATUS[agent.status].detail}</span>
          <Link href="/agent-desk" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Agent Desk</Link>
        </div>
      </div>
      <ProfileView agent={agent} skills={skills} fees={fees} preview pendingClips={pending} />
    </>
  );
}
