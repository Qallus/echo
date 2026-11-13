import { redirect } from "next/navigation";
import { myLiveAgent } from "@/lib/live-agents/agent-data";

// Picks up where you left off.
export default async function AgentSetupStart() {
  const agent = await myLiveAgent();
  redirect(`/agent-desk/setup/${agent?.setupStep ?? 1}`);
}
