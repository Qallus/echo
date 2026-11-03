"use client";

import { useState, useTransition } from "react";
import { Ban, LogOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { restoreUser, signOutUserEverywhere, suspendUser } from "@/lib/admin/actions/users";

// Account actions on the Customer 360 page (support, admins, owners).
export function UserActions({ userId, email, suspended, isStaff }: { userId: string; email: string; suspended: boolean; isStaff: boolean }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setMsg(await fn()));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending}
          onClick={() => confirm(`Sign ${email} out on every device?`) && run(() => signOutUserEverywhere(userId))}>
          <LogOut /> Sign out everywhere
        </Button>
        {suspended ? (
          <Button size="sm" disabled={pending} onClick={() => run(() => restoreUser(userId))}><RotateCcw /> Restore account</Button>
        ) : (
          <Button size="sm" variant="destructive" disabled={pending || isStaff} title={isStaff ? "Remove them from staff first" : undefined}
            onClick={() => {
              const reason = prompt(`Suspend ${email}? They'll be signed out and blocked from Echo until restored.\n\nReason (kept in the audit log):`);
              if (reason !== null) run(() => suspendUser(userId, reason));
            }}>
            <Ban /> Suspend
          </Button>
        )}
      </div>
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
    </div>
  );
}
