"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AgentCard } from "@/components/live-agents/agent-card";
import type { MapAgent } from "@/components/live-agents/agents-map";
import { money, type Filters, type LiveAgent, type Skill } from "@/lib/live-agents/types";
import { cn } from "@/lib/utils";

const AgentsMap = dynamic(() => import("@/components/live-agents/agents-map").then((m) => m.AgentsMap), {
  ssr: false, loading: () => <div className="h-full min-h-80 animate-pulse rounded-xl border bg-muted/40" />,
});

// Results in the chosen view. Cards and map pins share the hovered agent.
export function BrowseResults({ agents, skills, view }: { agents: LiveAgent[]; skills: Skill[]; view: Filters["view"] }) {
  const [active, setActive] = useState<string | null>(null);
  const bySlug = useMemo(() => new Map(skills.map((s) => [s.slug, s])), [skills]);
  const points = useMemo<MapAgent[]>(() => agents.filter((a) => a.lat != null && a.lng != null).map((a) => ({
    id: a.id, handle: a.handle, name: a.displayName, lat: a.lat!, lng: a.lng!,
    label: a.hourlyCents != null ? `${money(a.hourlyCents)} · ${a.displayName.split(" ")[0]}` : a.displayName,
  })), [agents]);

  const note = <p className="px-1 pt-2 text-xs text-muted-foreground">Areas are approximate (about 3 km). Remote Live Agents can cover any US time zone.</p>;

  if (view === "map") {
    return (
      <div>
        <AgentsMap agents={points} active={active} onHover={setActive} className="z-0 h-[70dvh] min-h-96 w-full overflow-hidden rounded-2xl border" />
        {note}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 gap-6", view === "grid" && "lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_28rem]")}>
      <div className={cn("grid grid-cols-1 gap-4", view === "grid" && "md:grid-cols-2")}>
        {agents.map((a) => <AgentCard key={a.id} agent={a} skills={bySlug} layout={view === "list" ? "list" : "grid"} active={active === a.id} onHover={setActive} />)}
      </div>
      {view === "grid" && (
        <aside className="hidden lg:sticky lg:top-20 lg:block">
          <div className="rounded-2xl border bg-card p-3">
            <p className="px-1 pb-2 text-sm font-medium">Browse by area</p>
            <AgentsMap agents={points} active={active} onHover={setActive} className="z-0 h-[calc(100dvh-12rem)] min-h-96 w-full overflow-hidden rounded-xl border" />
            {note}
          </div>
        </aside>
      )}
    </div>
  );
}
