import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrowseFilters, ViewToggle } from "@/components/live-agents/filters";
import { BrowseResults } from "@/components/live-agents/browse-results";
import { InterestButton } from "@/components/live-agents/interest-dialog";
import { getUser } from "@/lib/data";
import { getFees, listLiveAgents, listSkills, liveAgentStats } from "@/lib/live-agents/data";
import { hiringWorkspaces } from "@/lib/live-agents/messages";
import { parseFilters } from "@/lib/live-agents/types";

export const metadata = {
  title: "Redial Live Agents · Real people on your phones, when you need them",
  description: "Browse vetted, on-demand phone agents. Hear their voices, compare skills, languages and rates, and book coverage. Your Redial AI answers first and hands callers to a person when they need one.",
  alternates: { canonical: "/live-agents" },
};

// Public browse: hero, stat tiles, filters (in the URL), and results as a
// grid with a map, a list, or a full map.
export default async function LiveAgentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const [skills, stats, fees, user, workspaces] = await Promise.all([listSkills(), liveAgentStats(), getFees(), getUser(), hiringWorkspaces()]);
  const hiring = { signedIn: Boolean(user), workspaces };
  const { ready, agents, total } = await listLiveAgents(filters, skills);

  const tiles = [
    { label: "Available to take calls", value: String(stats.availableNow), extra: "online now" },
    { label: "Languages spoken", value: String(stats.languages.length || "—") },
    { label: "How it works", value: "Human + AI" },
    { label: "Your customers' details", value: "Private by design" },
  ];

  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-4 pt-12 pb-8 sm:px-6 sm:pt-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Redial Live Agents · Human support, intelligently connected</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Real people on your phones, when you need them.</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Your Redial AI answers every call and hands off to a vetted Live Agent when a caller needs a person. Hear their voices, compare skills and rates, and book coverage. Contact details stay private.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="lg" nativeButton={false} render={<Link href="/live-agents/how-it-works" />}>How it works</Button>
            <InterestButton kind="business" size="lg" skills={skills} source="/live-agents">Request coverage <ArrowRight /></InterestButton>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="mt-1 text-xl font-semibold sm:text-2xl">
                {t.value} {t.extra && <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">● {t.extra}</span>}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-16 sm:px-6">
        {!ready ? (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <Headset className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 text-xl font-semibold">Live Agents opens soon.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">We&apos;re onboarding the first group of agents now. Tell us what coverage you need, or apply to join.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <InterestButton kind="business" source="/live-agents">Request coverage</InterestButton>
              <Button variant="outline" nativeButton={false} render={<Link href="/become-a-live-agent" />}>Become a Live Agent</Button>
            </div>
          </div>
        ) : (
          <>
            <Suspense>
              <BrowseFilters filters={filters} skills={skills} languages={stats.languages} />
            </Suspense>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{filters.q || filters.skill || filters.language || filters.setup || filters.now || filters.rate !== "any" ? "Matching Live Agents" : "Recommended Live Agents"} · {agents.length} {agents.length === 1 ? "match" : "matches"}</h2>
                <p className="text-xs text-muted-foreground">
                  Rates shown are what the agent charges; Redial adds a {fees.businessFeePercent}% service fee at booking. Locations are shown by area only.
                </p>
              </div>
              <Suspense><ViewToggle view={filters.view} /></Suspense>
            </div>
            {agents.length ? (
              <BrowseResults agents={agents} skills={skills} view={filters.view} hiring={hiring} />
            ) : (
              <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No Live Agents match those filters{total ? "" : " yet"}. Try fewer filters, or <InterestButton kind="business" variant="ghost" size="sm" source="/live-agents">tell us what you need</InterestButton>.
              </div>
            )}
            {agents.some((a) => a.isDemo) && (
              <p className="text-xs text-muted-foreground">Profiles marked &ldquo;Demo profile&rdquo; are examples while the first Live Agents finish onboarding. Their voice clips are AI voices.</p>
            )}
          </>
        )}
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-4 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Great on the phone? Get paid for it.</h2>
            <p className="mt-1 text-muted-foreground">Set your own rates and hours, work from home, and let Redial&apos;s AI handle the busywork.</p>
          </div>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/become-a-live-agent" />}>Become a Live Agent <ArrowRight /></Button>
        </div>
      </section>
    </>
  );
}
