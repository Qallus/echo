"use client";

import { Building2, Clock, Mail, MapPin, Phone } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { prefixOf, type ProfileDetail } from "@/lib/profile-details";
import type { PersonCard } from "@/lib/types";
import { DETAIL_ICONS } from "./detail-icons";
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

// "1990-03-04" -> "March 4" (no year, no time zone shift).
function birthday(value: string) {
  const [, m, d] = value.split("-").map(Number);
  return m && d ? new Date(2000, m - 1, d).toLocaleDateString(undefined, { month: "long", day: "numeric" }) : value;
}

function DetailValue({ detail }: { detail: ProfileDetail }) {
  const { kind, value } = detail;
  // Only http(s) links: details can be written straight to the table, past the form's checks.
  const href = kind === "phone" ? `tel:${value}` : kind === "email" ? `mailto:${value}`
    : kind === "website" && /^https?:\/\//i.test(value) ? value : null;
  const text = kind === "birthday" ? birthday(value) : kind === "website" ? value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : value;
  return href
    ? <a href={href} target={kind === "website" ? "_blank" : undefined} rel="noreferrer" className="truncate hover:text-foreground">{text}</a>
    : <span className="truncate">{text}</span>;
}

export function ProfileSummary({ person }: { person: PersonCard }) {
  const { fullName, email, avatarUrl, jobTitle, company, phone, timezone, location, details } = person;
  const time = timezone ? localTime(timezone) : null;
  const role = [jobTitle, company].filter(Boolean).join(" · ");
  const prefix = prefixOf(details);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <UserAvatar name={fullName} email={email} src={avatarUrl} size="lg" />
        <div className="min-w-0">
          <div className="truncate font-medium">{fullName ? [prefix, fullName].filter(Boolean).join(" ") : email}</div>
          {role && <div className="truncate text-xs text-muted-foreground">{role}</div>}
        </div>
      </div>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-2"><Mail className="size-3.5 shrink-0" /><a href={`mailto:${email}`} className="truncate hover:text-foreground">{email}</a></li>
        {phone && <li className="flex items-center gap-2"><Phone className="size-3.5 shrink-0" /><a href={`tel:${phone}`} className="hover:text-foreground">{phone}</a></li>}
        {company && !jobTitle && <li className="flex items-center gap-2"><Building2 className="size-3.5 shrink-0" />{company}</li>}
        {location && <li className="flex items-center gap-2"><MapPin className="size-3.5 shrink-0" />{location}</li>}
        {time && <li className="flex items-center gap-2"><Clock className="size-3.5 shrink-0" />{time} local time</li>}
        {details.filter((d) => d.kind !== "prefix").map((d, i) => {
          const Icon = DETAIL_ICONS[d.kind];
          return (
            <li key={i} className="flex min-w-0 items-center gap-2">
              <Icon className="size-3.5 shrink-0" />
              <DetailValue detail={d} />
              {d.label && <span className="shrink-0 text-muted-foreground/70">{d.label}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
