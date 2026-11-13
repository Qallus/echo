"use client";

import Link from "next/link";
import { ArrowUpRight, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { AgentBadges, SkillChip } from "@/components/live-agents/icons";
import { MessageButton, type Hiring } from "@/components/live-agents/message-button";
import { VoiceSamplePlayer } from "@/components/live-agents/voice-sample";
import { ATTRIBUTES, firstName, money, type LiveAgent, type Skill } from "@/lib/live-agents/types";

// The setup details businesses ask about most, in this order.
const KEY_SETUP = ["door-closes", "usb-headset", "noise-cancelling", "wired-internet", "backup-internet", "backup-power", "quiet", "dedicated-desk", "webcam"];
import { cn } from "@/lib/utils";

// One Live Agent in the browse results (grid card or list row).
export function AgentCard({ agent: a, skills, hiring, layout = "grid", active, onHover }: {
  agent: LiveAgent; skills: Map<string, Skill>; hiring: Hiring; layout?: "grid" | "list"; active?: boolean; onHover?: (id: string | null) => void;
}) {
  const sample = a.samples[0];
  const setup = KEY_SETUP.filter((s) => a.workspace.includes(s) || a.equipment.includes(s)).slice(0, 3).map((s) => ATTRIBUTES.find((x) => x.slug === s)!.label);
  const chips = a.skills.map((s) => skills.get(s)).filter((s): s is Skill => Boolean(s)).slice(0, layout === "list" ? 5 : 3);
  return (
    <article
      onMouseEnter={() => onHover?.(a.id)} onMouseLeave={() => onHover?.(null)}
      className={cn("relative flex cursor-pointer flex-col gap-4 rounded-2xl border bg-card p-5 transition", active ? "border-foreground/40 shadow-md" : "hover:border-foreground/25",
        layout === "list" && "md:flex-row md:items-center")}
    >
      <div className={cn("flex min-w-0 gap-4", layout === "list" && "md:w-[22rem] md:shrink-0")}>
        <AgentAvatar name={a.displayName} url={a.avatarUrl} online={a.availableNow} />
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold leading-tight">
            {/* The name's link covers the whole card; the player and buttons sit above it. */}
            <Link href={`/live-agents/${a.handle}`} className="after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">{a.displayName}</Link>
          </h3>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {a.city}, {a.region}</span>
            {a.rating != null && <span className="inline-flex items-center gap-1"><Star className="size-3 fill-current" /> {a.rating.toFixed(2)} ({a.reviewCount})</span>}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <AgentBadges badges={a.badges} demo={a.isDemo} />
            <span className={cn("text-xs", a.availableNow ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
              {a.availableNow ? "● Available now" : "○ By schedule"}
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-sm">{a.headline}</p>
          <p className="text-xs text-muted-foreground">{a.yearsExperience} years experience · {a.languages.join(" / ")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">{chips.map((s) => <SkillChip key={s.slug} skill={s} />)}</div>
        {setup.length > 0 && <p className="text-xs text-muted-foreground">{setup.join(" · ")}</p>}
        {sample ? <VoiceSamplePlayer sample={sample} compact className="relative z-10" /> : <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">Voice sample coming soon</p>}
      </div>

      <div className={cn("flex flex-wrap items-end justify-between gap-3 border-t pt-4", layout === "list" && "md:w-48 md:shrink-0 md:flex-col md:items-stretch md:border-t-0 md:border-l md:pt-0 md:pl-5")}>
        <div>
          {a.hourlyCents != null && <p><span className="text-xl font-semibold">{money(a.hourlyCents)}</span><span className="text-xs text-muted-foreground"> / hour</span></p>}
          {a.perMinuteCents != null && <p className="text-xs text-muted-foreground">{money(a.perMinuteCents, { exact: true })}/min on demand</p>}
          {a.industries.length > 0 && <p className="text-xs text-muted-foreground">{a.industries.slice(0, 2).join(" · ")}</p>}
        </div>
        <div className="relative z-10 flex gap-2">
          <MessageButton size="sm" variant="outline" hiring={hiring} agent={{ id: a.id, name: firstName(a.displayName), handle: a.handle }}>Message</MessageButton>
          <Button size="sm" variant="secondary" nativeButton={false} render={<Link href={`/live-agents/${a.handle}`} />}>View profile <ArrowUpRight /></Button>
        </div>
      </div>
    </article>
  );
}
