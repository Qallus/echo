"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revokeGrant } from "./actions";

export function RevokeButton({ clientId, name }: { clientId: string; name: string }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button size="sm" variant={armed ? "destructive" : "outline"} disabled={pending} onBlur={() => setArmed(false)}
        aria-label={`Disconnect ${name}`}
        onClick={() => (armed ? start(async () => setError((await revokeGrant(clientId)).error)) : setArmed(true))}>
        {pending ? "Disconnecting…" : armed ? "Confirm" : "Disconnect"}
      </Button>
    </span>
  );
}
