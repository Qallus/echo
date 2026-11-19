"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, ShieldCheck, UserMinus } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { STAFF_ROLES, roleLabel, type StaffRole } from "@/lib/admin/permissions";
import { setStaffRole } from "./actions";

export type StaffMember = { user_id: string; email: string; full_name: string | null; role: StaffRole; mfa_enrolled: boolean };

const ROLE_OPTIONS = STAFF_ROLES.map((r) => ({ value: r.role, label: r.label }));
const TwoStep = ({ on }: { on: boolean }) => (on
  ? <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" /> 2-step on</Badge>
  : <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400"><ShieldAlert className="size-3" /> 2-step not set up</Badge>);

// Owners add people (who already have a Redial account) as staff, change
// their role, or remove them. Each change is written to the admin audit log.
export function StaffManager({ staff, meId }: { staff: StaffMember[]; meId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("support");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const name = (s: StaffMember) => s.full_name || s.email;

  const run = (e: string, r: StaffRole | null) => start(async () => {
    if (r === null && !confirm(`Remove ${e} from staff? They lose access to the admin area.`)) return;
    const res = await setStaffRole(e, r);
    setMsg(res);
    if (res.ok && e === email) setEmail("");
  });
  const removeMany = (rows: StaffMember[]) => {
    const others = rows.filter((s) => s.user_id !== meId);
    if (!others.length || !confirm(`Remove ${others.length === 1 ? others[0].email : `${others.length} people`} from staff? They lose access to the admin area.`)) return;
    start(async () => {
      for (const s of others) { const res = await setStaffRole(s.email, null); if (res.error) { setMsg(res); return; } }
      setMsg({ ok: `Removed ${others.length} from staff.` });
    });
  };

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-end gap-2 rounded-xl border p-4" onSubmit={(ev) => { ev.preventDefault(); run(email, role); }}>
        <label className="min-w-56 flex-1 space-y-1.5">
          <span className="text-sm font-medium">Email of a Redial account</span>
          <Input type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="name@company.com" required />
        </label>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Role</span>
          <Pick label="Role" className="w-fit" value={role} onChange={(v) => setRole(v as StaffRole)} options={ROLE_OPTIONS} />
        </div>
        <Button type="submit" disabled={pending}>Add or update</Button>
        <p className="w-full text-xs text-muted-foreground">{STAFF_ROLES.find((r) => r.role === role)?.detail} Staff must turn on two-step sign-in before they can use the admin area.</p>
      </form>
      {(msg.error || msg.ok) && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}

      <CollectionView<StaffMember>
        items={staff} getId={(s) => s.user_id} title={name} noun={["staff member", "staff"]} storageKey="admin-staff" defaultView="list"
        subtitle={(s) => (s.full_name ? s.email : roleLabel(s.role))}
        media={(s) => <UserAvatar name={s.full_name} email={s.email} src={null} size="md" />}
        badge={(s) => <Badge>{roleLabel(s.role)}{s.user_id === meId ? " (you)" : ""}</Badge>}
        meta={(s) => <TwoStep on={s.mfa_enrolled} />}
        searchText={(s) => `${s.full_name ?? ""} ${s.email} ${roleLabel(s.role)}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          ...STAFF_ROLES.map((r) => ({ id: r.role, label: r.label, test: (s: StaffMember) => s.role === r.role })),
          { id: "no2step", label: "2-step not set up", test: (s) => !s.mfa_enrolled },
        ]}
        columns={[
          { id: "name", label: "Name", sort: (s) => name(s).toLowerCase(), cell: (s) => <span className="font-medium">{name(s)}</span> },
          { id: "email", label: "Email", sort: (s) => s.email, cell: (s) => <span className="text-muted-foreground">{s.email}</span> },
          { id: "role", label: "Role", sort: (s) => roleLabel(s.role), cell: (s) => <Badge>{roleLabel(s.role)}</Badge> },
          { id: "mfa", label: "Two-step sign-in", sort: (s) => (s.mfa_enrolled ? 1 : 0), cell: (s) => <TwoStep on={s.mfa_enrolled} /> },
        ]}
        actions={[{ label: "Remove from staff", icon: UserMinus, destructive: true, show: (rows) => rows.some((s) => s.user_id !== meId), run: removeMany }]}
        preview={(s) => (
          <div className="space-y-4 text-sm">
            <TwoStep on={s.mfa_enrolled} />
            <p className="text-muted-foreground">{s.email}</p>
            {s.user_id === meId ? (
              <p className="text-muted-foreground">This is you. Another owner can change your role.</p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium">Role</span>
                  <Pick label={`Role for ${s.email}`} className="w-fit" value={s.role} disabled={pending} onChange={(v) => run(s.email, v as StaffRole)} options={ROLE_OPTIONS} />
                  <p className="text-xs text-muted-foreground">{STAFF_ROLES.find((r) => r.role === s.role)?.detail}</p>
                </div>
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(s.email, null)}><UserMinus /> Remove from staff</Button>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
