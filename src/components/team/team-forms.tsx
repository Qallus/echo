"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { CopyButton } from "@/components/copy-button";
import { Input } from "@/components/ui/input";
import {
  acceptInvite, createTeamWorkspace, inviteMember, removeMember, revokeInvite,
  type ActionResult, type InviteResult,
} from "@/lib/actions";

export function CreateWorkspaceForm({ first }: { first: boolean }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createTeamWorkspace, {});
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <Input name="name" placeholder={first ? "Company or team name" : "Another business workspace"} maxLength={120} required />
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function CopyLink({ link }: { link: string }) {
  return <CopyButton value={link} label="Copy link" />;
}

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState<InviteResult, FormData>(inviteMember, {});
  const [round, setRound] = useState(0); // remounts the role dropdown when React resets the form
  return (
    <div className="space-y-3">
      <form action={action} onReset={() => setRound((n) => n + 1)} className="flex flex-wrap gap-2">
        <input type="hidden" name="workspace_id" value={workspaceId} />
        <Input name="email" type="email" placeholder="teammate@company.com" required className="min-w-56 flex-1" />
        <Pick key={round} name="role" defaultValue="member" label="Role" className="w-auto"
          options={[{ value: "member", label: "Member" }, { value: "admin", label: "Admin" }]} />
        <Button type="submit" disabled={pending}>{pending ? "Inviting…" : "Invite"}</Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.link && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="flex-1">
            Invite created for <span className="font-medium">{state.email}</span>. Send them this link; it works only
            when they sign in with that email.
          </span>
          <CopyLink link={state.link} />
        </div>
      )}
    </div>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => revokeInvite(id))}>
      {pending ? "Revoking…" : "Revoke"}
    </Button>
  );
}

// Two clicks: "Remove" / "Leave", then "Confirm".
export function RemoveMemberButton({ workspaceId, userId, self }: { workspaceId: string; userId: string; self: boolean }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const res = await removeMember(workspaceId, userId);
      setError(res?.error);
      setArmed(false);
    });
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button variant={armed ? "destructive" : "ghost"} size="sm" disabled={pending}
        onClick={armed ? run : () => setArmed(true)} onBlur={() => setArmed(false)}>
        {pending ? "…" : armed ? "Confirm" : self ? "Leave" : "Remove"}
      </Button>
    </span>
  );
}

export function AcceptInviteButton({ token }: { token: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button className="w-full" disabled={pending}
        onClick={() => start(async () => setError((await acceptInvite(token))?.error))}>
        {pending ? "Joining…" : "Join workspace"}
      </Button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
