"use client";

import { useState, useTransition } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeShare, shareLine, updateShare } from "@/lib/redial/actions";
import type { LinePerson } from "@/lib/redial/data";
import { SHAREABLE } from "@/lib/redial/features";

// Who else can use this line, and for what. Only the owner sees this. People
// must already share one of the owner's workspaces.
export function LinePeople({ lineId, people }: { lineId: string; people: LinePerson[] }) {
  const [email, setEmail] = useState("");
  const [caps, setCaps] = useState<string[]>(["read_summary"]);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((c) => c !== id));

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Share this line with people in your workspaces. Each person gets only what you tick; paying for the plan never gives anyone access to your calls.
      </p>
      <form className="space-y-3 rounded-xl border p-4" onSubmit={(e) => {
        e.preventDefault();
        start(async () => { const r = await shareLine(lineId, email, caps); setMsg(r); if (r.ok) { setEmail(""); setCaps(["read_summary"]); } });
      }}>
        <div className="space-y-1.5"><Label htmlFor="share-email">Their email</Label>
          <Input id="share-email" type="email" className="max-w-sm" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" required />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">They can</legend>
          {SHAREABLE.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm"><Checkbox checked={caps.includes(c.id)} onCheckedChange={(v) => setCaps(toggle(caps, c.id, Boolean(v)))} />{c.label}</label>
          ))}
        </fieldset>
        <Button type="submit" size="sm" disabled={pending}><UserPlus /> Share</Button>
        {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
      </form>

      {people.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {people.map((p) => <PersonRow key={p.grant_id} person={p} />)}
        </ul>
      )}
    </div>
  );
}

function PersonRow({ person: p }: { person: LinePerson }) {
  const [caps, setCaps] = useState(p.capabilities);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (next: string[]) => { setCaps(next); start(async () => { const r = await updateShare(p.grant_id, next); setError(r.error ?? null); if (r.error) setCaps(caps); }); };
  return (
    <li className="space-y-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0"><p className="truncate text-sm font-medium">{p.full_name || p.email}</p>{p.full_name && <p className="truncate text-xs text-muted-foreground">{p.email}</p>}</div>
        <Button variant="ghost" size="icon-sm" aria-label={`Stop sharing with ${p.email}`} disabled={pending}
          onClick={() => { if (confirm(`Stop sharing this line with ${p.full_name || p.email}?`)) start(async () => { const r = await removeShare(p.grant_id); setError(r.error ?? null); }); }}><Trash2 /></Button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {SHAREABLE.map((c) => (
          <label key={c.id} className="flex items-center gap-1.5 text-xs">
            <Checkbox checked={caps.includes(c.id)} disabled={pending} onCheckedChange={(v) => save(v ? [...caps, c.id] : caps.filter((x) => x !== c.id))} />{c.label}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}
