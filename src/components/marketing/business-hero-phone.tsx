import { CalendarCheck, ShieldX, UserRoundCheck } from "lucide-react";
import { BUSINESS_HERO_FRAMES } from "@/components/marketing/phones/frames";
import { DeskPhone } from "@/components/marketing/phones/phone-art";
import { Named } from "@/components/marketing/agent-name";
import { cn } from "@/lib/utils";

// The Redial for business hero: the desk phone stepping through a lead the
// assistant qualifies and transfers, with what it did floating around it.
const CHIPS = [
  { icon: UserRoundCheck, title: "Lead qualified", detail: "Urgent · in your service area", pos: "left-0 top-[8%] sm:-left-4", delay: "0s" },
  { icon: ShieldX, title: "Spam blocked", detail: "{agent} hung up on 3 robocalls", pos: "right-0 top-[58%] sm:-right-3", delay: "1.6s" },
  { icon: CalendarCheck, title: "Job booked", detail: "2 PM · summary sent to the crew", pos: "left-[6%] bottom-[4%]", delay: "3.2s" },
];

export function BusinessHeroPhone({ className }: { className?: string }) {
  return (
    <div className={cn("relative py-10", className)}>
      <DeskPhone frames={BUSINESS_HERO_FRAMES} className="lg:[zoom:0.74] xl:[zoom:0.82]" />
      {CHIPS.map(({ icon: Icon, title, detail, pos, delay }) => (
        <div key={title} className={cn("float-y absolute z-10 hidden items-center gap-2.5 rounded-xl border bg-background/95 py-2 pr-3.5 pl-2 shadow-lg backdrop-blur sm:flex", pos)}
          style={{ animationDelay: delay }} aria-hidden>
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" /></span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block text-xs text-muted-foreground"><Named text={detail} /></span>
          </span>
        </div>
      ))}
    </div>
  );
}
