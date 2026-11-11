"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, ShieldCheck, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { STAFF_ROLES, roleLabel, type StaffRole } from "@/lib/admin/permissions";
import { setStaffRole } from "./actions";

export type StaffMember = { user_id: string; email: string; full_name: string | null; role: StaffRole; mfa_enrolled: boolean };

const ROLE_OPTIONS = STAFF_ROLES.map((r) => ({ value: r.role, label: r.label }));

// Owners add people (who already have an Echo account) as staff, change their
// role, or remove them. Each change is written to the admin audit log.
export function StaffManager({ staff, meId }: { staff: StaffMember[]; meId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("support");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const run = (e: string, r: StaffRole | null) => start(async () => {
    if (r === null && !confirm(`Remove ${e} from staff? They lose access to the admin area.`)) return;
    const res = await setStaffRole(e, r);
    setMsg(res);
    if (res.ok && e === email) setEmail("");
  });

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-end gap-2 rounded-xl border p-4" onSubmit={(ev) => { ev.preventDefault(); run(email, role); }}>
        <label className="min-w-56 flex-1 space-y-1.5">
          <span className="text-sm font-medium">Email of an Echo account</span>
          <Input type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="name@company.com" required />
        </label>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Role</span>
          <Pick label="Role" className="w-fit" value={role} onChange={(v) => setRole(v as StaffRole)} options={ROLE_OPTIONS} />
        </div>
        <Button type="submit" disabled={pending}>Add or update</Button>
        <p className="w-full text-xs text-muted-foreground">{STAFF_ROLES.find((r) => r.role === role)?.detail} Staff must turn on two-step sign-in before they can use the admin area.</p>
      </form>
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}

      <ul className="divide-y rounded-xl border">
        {staff.map((s) => (
          <li key={s.user_id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{s.full_name || s.email}</p>
              {s.full_name && <p className="truncate text-xs text-muted-foreground">{s.email}</p>}
            </div>
            {s.mfa_enrolled
              ? <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" /> 2-step on</Badge>
              : <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400"><ShieldAlert className="size-3" /> 2-step not set up</Badge>}
            {s.user_id === meId ? (
              <Badge>{roleLabel(s.role)} (you)</Badge>
            ) : (
              <>
                <Pick label={`Role for ${s.email}`} className="w-fit" value={s.role} disabled={pending} onChange={(v) => run(s.email, v as StaffRole)} options={ROLE_OPTIONS} />
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${s.email}`} disabled={pending} onClick={() => run(s.email, null)}><UserMinus /></Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
