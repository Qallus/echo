"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { transferWorkspace } from "@/lib/admin/actions/users";

// Makes another member the owner; current owners become admins.
export function TransferOwner({ workspaceId, members }: { workspaceId: string; members: { user_id: string; label: string }[] }) {
  const [to, setTo] = useState(members[0]?.user_id ?? "");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  if (!members.length) return <p className="text-sm text-muted-foreground">Add another member to this workspace before transferring ownership.</p>;
  return (
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      const name = members.find((m) => m.user_id === to)?.label;
      if (confirm(`Make ${name} the owner? Current owners become admins.`)) start(async () => setMsg(await transferWorkspace(workspaceId, to)));
    }}>
      <div className="flex gap-2">
        <Pick label="New owner" className="flex-1" value={to} onChange={setTo} options={members.map((m) => ({ value: m.user_id, label: m.label }))} />
        <Button type="submit" size="sm" disabled={pending}>Transfer</Button>
      </div>
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
    </form>
  );
}
