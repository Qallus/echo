"use client";

import { Mail, Phone, ShieldCheck, ShieldOff } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { LocalDate } from "@/components/local-date";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { roleLabel, type StaffRole } from "@/lib/admin/permissions";
import { money } from "@/lib/billing/catalog";

export type TeamMember = {
  user_id: string; name: string; email: string; role: StaffRole; avatar_url: string | null; job_title: string | null; phone: string | null;
  last_sign_in_at: string | null; mfa: boolean;
  load: { deals: number; value: number; contacts: number; tasks: number; bookings: number };
};

const TwoStep = ({ on }: { on: boolean }) => (on
  ? <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" /> 2-step</Badge>
  : <Badge variant="outline" className="gap-1 text-muted-foreground"><ShieldOff className="size-3" /> No 2-step</Badge>);

// Everyone on staff with what's on their plate (open deals, contacts, plan
// tasks, upcoming bookings), in the shared list layout.
export function TeamList({ members }: { members: TeamMember[] }) {
  const roles = [...new Set(members.map((m) => m.role))];
  return (
    <CollectionView<TeamMember>
      items={members} getId={(m) => m.user_id} title={(m) => m.name} noun={["person", "people"]} storageKey="admin-team" defaultView="cards"
      subtitle={(m) => m.job_title || m.email}
      media={(m) => <UserAvatar name={m.name} email={m.email} src={m.avatar_url} size="md" />}
      badge={(m) => <Badge>{roleLabel(m.role)}</Badge>}
      meta={(m) => <>{m.load.deals} deals · {m.load.contacts} contacts · {m.load.tasks} tasks · {m.load.bookings} bookings</>}
      searchText={(m) => `${m.name} ${m.email} ${m.job_title ?? ""} ${roleLabel(m.role)}`}
      filters={[
        { id: "all", label: "Everyone", test: () => true },
        ...roles.map((r) => ({ id: r, label: roleLabel(r), test: (m: TeamMember) => m.role === r })),
        { id: "no2step", label: "No 2-step", test: (m) => !m.mfa },
      ]}
      columns={[
        { id: "name", label: "Name", sort: (m) => m.name.toLowerCase(), cell: (m) => (
          <span className="flex items-center gap-2.5"><UserAvatar name={m.name} email={m.email} src={m.avatar_url} size="sm" /><span className="min-w-0"><span className="block truncate font-medium">{m.name}</span><span className="block truncate text-xs text-muted-foreground">{m.job_title || m.email}</span></span></span>
        ) },
        { id: "role", label: "Role", sort: (m) => roleLabel(m.role), cell: (m) => <Badge>{roleLabel(m.role)}</Badge> },
        { id: "mfa", label: "Two-step", sort: (m) => (m.mfa ? 1 : 0), cell: (m) => <TwoStep on={m.mfa} /> },
        { id: "deals", label: "Open deals", sort: (m) => m.load.deals, cell: (m) => <span className="tabular-nums">{m.load.deals}</span> },
        { id: "value", label: "Deal value", sort: (m) => m.load.value, cell: (m) => <span className="tabular-nums">{m.load.value ? money(m.load.value) : "—"}</span> },
        { id: "contacts", label: "Contacts", sort: (m) => m.load.contacts, cell: (m) => <span className="tabular-nums">{m.load.contacts}</span> },
        { id: "tasks", label: "Tasks", sort: (m) => m.load.tasks, cell: (m) => <span className="tabular-nums">{m.load.tasks}</span> },
        { id: "bookings", label: "Bookings", sort: (m) => m.load.bookings, cell: (m) => <span className="tabular-nums">{m.load.bookings}</span> },
        { id: "last", label: "Last sign-in", sort: (m) => m.last_sign_in_at, cell: (m) => <span className="text-muted-foreground">{m.last_sign_in_at ? <LocalDate iso={m.last_sign_in_at} short /> : "Never"}</span> },
      ]}
      actions={[
        { label: "Email", icon: Mail, run: (rows) => { window.location.href = `mailto:?bcc=${rows.map((m) => encodeURIComponent(m.email)).join(",")}`; } },
      ]}
      preview={(m) => (
        <div className="space-y-4 text-sm">
          <TwoStep on={m.mfa} />
          <div className="grid grid-cols-4 gap-2 text-center">
            {([["Deals", m.load.deals], ["Contacts", m.load.contacts], ["Tasks", m.load.tasks], ["Bookings", m.load.bookings]] as const).map(([label, n]) => (
              <div key={label} className="rounded-lg bg-muted/40 py-2"><p className="text-lg font-semibold tabular-nums">{n}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
            ))}
          </div>
          <div className="space-y-1 text-muted-foreground">
            {m.load.value > 0 && <p>{money(m.load.value)} in open deals</p>}
            <p className="flex items-center gap-1.5"><Mail className="size-3.5" /><a href={`mailto:${m.email}`} className="truncate hover:underline">{m.email}</a></p>
            {m.phone && <p className="flex items-center gap-1.5"><Phone className="size-3.5" /><a href={`tel:${m.phone}`} className="hover:underline">{m.phone}</a></p>}
            <p className="text-xs">Last signed in {m.last_sign_in_at ? <LocalDate iso={m.last_sign_in_at} short /> : "never"}</p>
          </div>
        </div>
      )}
    />
  );
}
