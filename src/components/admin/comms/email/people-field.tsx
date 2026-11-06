"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type Person = { id: string; name: string; email: string | null };

// "To": CRM contacts as chips (search to add), plus typed addresses.
export function PeopleField({ people, to, setTo, typed, setTyped }: {
  people: Person[]; to: Person[]; setTo: (p: Person[]) => void; typed: string; setTyped: (v: string) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people.filter((p) => p.email && !to.some((t) => t.id === p.id) && `${p.name} ${p.email}`.toLowerCase().includes(q)).slice(0, 8);
  }, [people, query, to]);
  const noEmail = to.filter((p) => !p.email).length;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 rounded-lg border p-2">
        {to.map((p) => (
          <Badge key={p.id} variant={p.email ? "secondary" : "outline"} className="gap-1" title={p.email ?? "No email address"}>
            {p.name}{!p.email && " (no email)"}
            <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setTo(to.filter((x) => x.id !== p.id))}><X className="size-3" /></button>
          </Badge>
        ))}
        {people.length > 0 && (
          <div className="relative min-w-40 flex-1">
            <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Add a contact…" className="h-7 w-full bg-transparent pl-7 text-sm outline-none" aria-label="Add a contact" />
            {matches.length > 0 && (
              <ul className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border bg-popover p-1 shadow-md">
                {matches.map((p) => (
                  <li key={p.id}><button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => { setTo([...to, p]); setQuery(""); }}>
                    {p.name} <span className="text-xs text-muted-foreground">{p.email}</span></button></li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Other addresses, comma separated" aria-label="Other email addresses" />
      {noEmail > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">{noEmail} selected {noEmail === 1 ? "has" : "have"} no email address and will be skipped.</p>}
    </div>
  );
}
