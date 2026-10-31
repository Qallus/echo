"use client";

import { Building2, Clock, Mail, MapPin, Phone } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { PersonCard } from "@/lib/types";
import { UserAvatar } from "./user-avatar";

function localTime(tz: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date());
  } catch {
    return null;
  }
}

// Hover (or tap) a person to see who they are and how to reach them.
export function ProfileHoverCard({ person, children }: { person: PersonCard; children: React.ReactNode }) {
  return (
    <HoverCard>
      <HoverCardTrigger delay={250} render={<span className="cursor-default" />}>{children}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 p-4">
        <ProfileSummary person={person} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function ProfileSummary({ person }: { person: PersonCard }) {
  const { fullName, email, avatarUrl, jobTitle, company, phone, timezone, location } = person;
  const time = timezone ? localTime(timezone) : null;
  const role = [jobTitle, company].filter(Boolean).join(" · ");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <UserAvatar name={fullName} email={email} src={avatarUrl} size="lg" />
        <div className="min-w-0">
          <div className="truncate font-medium">{fullName || email}</div>
          {role && <div className="truncate text-xs text-muted-foreground">{role}</div>}
        </div>
      </div>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-2"><Mail className="size-3.5 shrink-0" /><a href={`mailto:${email}`} className="truncate hover:text-foreground">{email}</a></li>
        {phone && <li className="flex items-center gap-2"><Phone className="size-3.5 shrink-0" /><a href={`tel:${phone}`} className="hover:text-foreground">{phone}</a></li>}
        {company && !jobTitle && <li className="flex items-center gap-2"><Building2 className="size-3.5 shrink-0" />{company}</li>}
        {location && <li className="flex items-center gap-2"><MapPin className="size-3.5 shrink-0" />{location}</li>}
        {time && <li className="flex items-center gap-2"><Clock className="size-3.5 shrink-0" />{time} local time</li>}
      </ul>
    </div>
  );
}
