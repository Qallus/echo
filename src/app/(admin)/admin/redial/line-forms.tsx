"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignRedialLine, removeRedialLine } from "@/lib/admin/actions/redial";

export function AssignLine() {
  const [email, setEmail] = useState("");
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { const r = await assignRedialLine(email, number, label); setMsg(r); if (r.ok) { setEmail(""); setNumber(""); setLabel(""); } });
    }}>
      <div className="space-y-1"><Label htmlFor="rl-email" className="text-xs">Member&apos;s email</Label><Input id="rl-email" type="email" className="w-60" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="space-y-1"><Label htmlFor="rl-number" className="text-xs">Twilio number</Label><Input id="rl-number" type="tel" className="w-44" placeholder="+1 480 555 0100" value={number} onChange={(e) => setNumber(e.target.value)} required /></div>
      <div className="space-y-1"><Label htmlFor="rl-label" className="text-xs">Label (optional)</Label><Input id="rl-label" className="w-40" placeholder="Work line" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
      <Button type="submit" disabled={pending}>{pending ? "Assigning…" : "Assign"}</Button>
      {(msg.ok || msg.error) && <p className={`w-full text-sm ${msg.error ? "text-destructive" : "text-muted-foreground"}`}>{msg.error ?? msg.ok}</p>}
    </form>
  );
}

export function RemoveLine({ id, number }: { id: string; number: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${number}`} disabled={pending}
      onClick={() => { if (confirm(`Remove ${number}? Calls to it will stop being answered, and the member's call history for it is deleted.`)) start(async () => { const r = await removeRedialLine(id); if (r.error) alert(r.error); }); }}>
      <Trash2 />
    </Button>
  );
}
