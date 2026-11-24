import Link from "next/link";
import { Suspense } from "react";
import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentTabs } from "@/components/live-agents/agent-tabs";
import { BrowseFilters, ViewToggle } from "@/components/live-agents/filters";
import { BrowseResults } from "@/components/live-agents/browse-results";
import { InterestButton } from "@/components/live-agents/interest-dialog";
import { requireUser } from "@/lib/data";
import { getFees, listLiveAgents, listSkills, liveAgentStats } from "@/lib/live-agents/data";
import { hiringWorkspaces } from "@/lib/live-agents/messages";
import { parseFilters } from "@/lib/live-agents/types";

export const metadata = { title: "Search Live Agents · Redial" };

// Find Live Agents inside the dashboard: the same browse as the public page
// (filters in the URL, grid, list or map), under the Agents tabs.
export default async function AgentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const filters = parseFilters(await searchParams);
  const [skills, stats, fees, workspaces] = await Promise.all([listSkills(), liveAgentStats(), getFees(), hiringWorkspaces()]);
  const hiring = { signedIn: true, workspaces };
  const { ready, agents, total } = await listLiveAgents(filters, skills);
  const filtered = Boolean(filters.q || filters.skill || filters.language || filters.setup || filters.now || filters.rate !== "any");

  return (
    <div className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="max-md:sr-only">
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground">Real people your Redial AI hands calls to: hear their voices, compare skills and rates, and book coverage.</p>
      </div>
      <AgentTabs />
      {!ready ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Headset className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-xl font-semibold">Live Agents opens soon.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">We&apos;re onboarding the first group of agents now. Tell us what coverage you need, or apply to join.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <InterestButton kind="business" source="/agents">Request coverage</InterestButton>
            <Button variant="outline" nativeButton={false} render={<Link href="/agent-desk" />}>Become a Live Agent</Button>
          </div>
        </div>
      ) : (
        <>
          <Suspense><BrowseFilters filters={filters} skills={skills} languages={stats.languages} /></Suspense>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{filtered ? "Matching Live Agents" : "Recommended Live Agents"} · {agents.length} {agents.length === 1 ? "match" : "matches"}</h2>
              <p className="text-xs text-muted-foreground">
                {stats.availableNow} available now. Rates are what the agent charges; Redial adds a {fees.businessFeePercent}% service fee at booking.
              </p>
            </div>
            <Suspense><ViewToggle view={filters.view} /></Suspense>
          </div>
          {agents.length ? (
            <BrowseResults agents={agents} skills={skills} view={filters.view} hiring={hiring} />
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No Live Agents match those filters{total ? "" : " yet"}. Try fewer filters, or <InterestButton kind="business" variant="ghost" size="sm" source="/agents">tell us what you need</InterestButton>.
            </div>
          )}
        </>
      )}
    </div>
  );
}
