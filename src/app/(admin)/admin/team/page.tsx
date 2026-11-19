import Link from "next/link";
import { connection } from "next/server";
import { AdminPage } from "@/components/admin/admin-ui";
import { StatRow, StatTile } from "@/components/admin/crm/crm-kit";
import { can, requireStaff } from "@/lib/admin/guard";
import type { StaffRole } from "@/lib/admin/permissions";
import { TeamList } from "./team-list";
import { OPEN_STAGES } from "@/lib/crm/deals";
import { crmStaff, listContacts, listDeals } from "@/lib/crm/data";
import { listBookings } from "@/lib/bookings/data";
import { openTasksByAssignee } from "@/lib/plans/data";

export const metadata = { title: "Team · Admin · Redial" };

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
    <AdminPage title="Team" description="Everyone on staff, their role, and what's on their plate."
      actions={can(staff, "staff.manage") ? <Link href="/admin/users?tab=staff" className="text-sm text-primary hover:underline">Manage staff and roles</Link> : undefined}>
      <StatRow>
        <StatTile label="Staff" value={members.length} />
        <StatTile label="With two-step on" value={members.filter((m) => m.mfa).length} />
        <StatTile label="Open deals assigned" value={deals.filter((d) => d.owner_id && OPEN_STAGES.includes(d.stage)).length} />
        <StatTile label="Unassigned open deals" value={unowned} accent={unowned > 0} />
      </StatRow>
      <TeamList members={members.map((m) => ({ ...m, load: load(m.user_id) }))} />
    </AdminPage>
  );
}
