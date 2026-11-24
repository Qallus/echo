import { Suspense } from "react";
import { LinkTabs } from "@/components/shell/link-tabs";
import { hasLiveAgentProfile } from "@/lib/live-agents/agent-data";
import { AGENT_TABS } from "@/lib/nav";

// The Agents section's tabs: find people, the ones you hired, messages, your
// own Agent Desk, and AI agents.
export async function AgentTabs({ className }: { className?: string }) {
  const liveAgent = await hasLiveAgentProfile();
  return <Suspense><LinkTabs label="Agents" tabs={AGENT_TABS(liveAgent).map((t) => ({ ...t, exact: "exact" in t ? t.exact : false }))} className={className} /></Suspense>;
}
