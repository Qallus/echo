import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasLiveAgentProfile } from "@/lib/live-agents/agent-data";
import { callsBadge } from "@/lib/redial/data";
import { FEATURE_GROUPS, visibleFeatures } from "@/lib/features";
import { workspaceCrmReady } from "@/lib/crm/scope";

export const metadata = { title: "Explore · Redial" };

// Every feature, what it does, and how you'd use it at home and at work.
// Same list as the All features slide-out and Ask Echo (lib/features.ts).
export default async function ExplorePage() {
  const [calls, liveAgent, crmReady] = await Promise.all([callsBadge(), hasLiveAgentProfile(), workspaceCrmReady()]);
  const list = visibleFeatures({ line: calls !== null, liveAgent, crmReady });
  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
          <p className="text-sm text-muted-foreground">Everything Redial does, and how to use it for your personal life and your business.</p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/ask" />}><Sparkles /> Ask Echo how</Button>
      </div>
      {FEATURE_GROUPS.map((g) => {
        const items = list.filter((f) => f.group === g);
        if (!items.length) return null;
        return (
          <section key={g} className="space-y-3">
            <h2 className="text-lg font-semibold">{g}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map(({ title, href, icon: Icon, what, personal, business, soon }) => (
                <Link key={title} href={href} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="grid size-9 place-items-center rounded-lg bg-muted"><Icon className="size-4" /></span>
                    {soon && <Badge variant="outline">Coming soon</Badge>}
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{what}</p>
                  <dl className="mt-auto space-y-1 pt-1 text-xs">
                    <div><dt className="inline font-medium">Personal: </dt><dd className="inline text-muted-foreground">{personal}</dd></div>
                    <div><dt className="inline font-medium">Business: </dt><dd className="inline text-muted-foreground">{business}</dd></div>
                  </dl>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
