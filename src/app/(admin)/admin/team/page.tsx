import Link from "next/link";
import { connection } from "next/server";
import { Mail, Phone, ShieldCheck, ShieldOff } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { StatRow, StatTile } from "@/components/admin/crm/crm-kit";
import { LocalDate } from "@/components/local-date";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { can, requireStaff } from "@/lib/admin/guard";
import { roleLabel, type StaffRole } from "@/lib/admin/permissions";
import { money } from "@/lib/billing/catalog";
import { OPEN_STAGES } from "@/lib/crm/deals";
import { crmStaff, listContacts, listDeals } from "@/lib/crm/data";
import { listBookings } from "@/lib/bookings/data";
import { openTasksByAssignee } from "@/lib/plans/data";

export const metadata = { title: "Team · Admin · Echo" };

type Member = { user_id: string; name: string; email: string; role: StaffRole; avatar_url: string | null; job_title: string | null; phone: string | null; last_sign_in_at: string | null; mfa: boolean };

// The Qallus team: who's on staff, their role, and what's on their plate
// (open deals, contacts, plan tasks, upcoming bookings).
export default async function TeamPage() {
  const staff = await requireStaff("crm.view");
  await connection();
  const [people, deals, contacts, tasks, bookings] = await Promise.all([crmStaff(), listDeals(), listContacts(), openTasksByAssignee(), listBookings()]);
  const members = people as unknown as Member[];
  const now = new Date().toISOString();
  const load = (id: string) => {
    const open = deals.filter((d) => d.owner_id === id && OPEN_STAGES.includes(d.stage));
    return {
      deals: open.length, value: open.reduce((n, d) => n + d.value_cents, 0), contacts: contacts.filter((c) => c.owner_id === id).length,
      tasks: tasks[id] ?? 0, bookings: bookings.filter((b) => b.host_id === id && b.starts_at >= now && (b.status === "confirmed" || b.status === "pending")).length,
    };
  };
  const unowned = deals.filter((d) => !d.owner_id && OPEN_STAGES.includes(d.stage)).length;

  return (
    <AdminPage title="Team" description="Everyone on staff, their role, and what's on their plate." className="max-w-[96rem]"
      actions={can(staff, "staff.manage") ? <Link href="/admin/users?tab=staff" className="text-sm text-primary hover:underline">Manage staff and roles</Link> : undefined}>
      <StatRow>
        <StatTile label="Staff" value={members.length} />
        <StatTile label="With two-step on" value={members.filter((m) => m.mfa).length} />
        <StatTile label="Open deals assigned" value={deals.filter((d) => d.owner_id && OPEN_STAGES.includes(d.stage)).length} />
        <StatTile label="Unassigned open deals" value={unowned} accent={unowned > 0} />
      </StatRow>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => {
          const w = load(m.user_id);
          return (
            <div key={m.user_id} className="space-y-4 rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <UserAvatar name={m.name} email={m.email} src={m.avatar_url} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{m.job_title || m.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge>{roleLabel(m.role)}</Badge>
                    {m.mfa ? <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" /> 2-step</Badge> : <Badge variant="outline" className="gap-1 text-muted-foreground"><ShieldOff className="size-3" /> No 2-step</Badge>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {([["Deals", w.deals], ["Contacts", w.contacts], ["Tasks", w.tasks], ["Bookings", w.bookings]] as const).map(([label, n]) => (
                  <div key={label} className="rounded-lg bg-muted/40 py-2"><p className="text-lg font-semibold tabular-nums">{n}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
                ))}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {w.value > 0 && <p>{money(w.value)} in open deals</p>}
                <p className="flex items-center gap-1.5"><Mail className="size-3.5" /><a href={`mailto:${m.email}`} className="truncate hover:underline">{m.email}</a></p>
                {m.phone && <p className="flex items-center gap-1.5"><Phone className="size-3.5" /><a href={`tel:${m.phone}`} className="hover:underline">{m.phone}</a></p>}
                <p className="text-xs">Last signed in {m.last_sign_in_at ? <LocalDate iso={m.last_sign_in_at} short /> : "never"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </AdminPage>
  );
}
