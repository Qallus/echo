"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LayoutGrid, Mail, Phone, Rows3, Search } from "lucide-react";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contactName, type Contact, type StaffOption } from "@/lib/crm/types";
import { FILTER, ownerName } from "./crm-ui";
import { AddContactButton } from "./record-actions";


// Searchable contact list (table or cards); each opens its page.
export function ContactsList({ contacts, companies, staff, readOnly }: {
  contacts: Contact[]; companies: { id: string; name: string }[]; staff: StaffOption[]; readOnly: boolean;
}) {
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("");
  const [tag, setTag] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");
  const allTags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) =>
      (!owner || c.owner_id === owner) && (!tag || c.tags.includes(tag))
      && (!q || `${contactName(c)} ${c.email ?? ""} ${c.phone ?? ""} ${c.company?.name ?? ""} ${c.title ?? ""}`.toLowerCase().includes(q)));
  }, [contacts, query, owner, tag]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone, client" className="pl-8" aria-label="Search contacts" />
        </div>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className={FILTER} aria-label="Owner">
          <option value="">All owners</option>
          {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
        </select>
        {allTags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} className={FILTER} aria-label="Tag">
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <div className="flex rounded-lg border p-0.5">
          <Button variant={view === "table" ? "secondary" : "ghost"} size="icon-sm" aria-label="Table view" onClick={() => setView("table")}><Rows3 /></Button>
          <Button variant={view === "cards" ? "secondary" : "ghost"} size="icon-sm" aria-label="Card view" onClick={() => setView("cards")}><LayoutGrid /></Button>
        </div>
        <span className="text-sm text-muted-foreground">{shown.length} of {contacts.length}</span>
        {!readOnly && <span className="ml-auto"><AddContactButton companies={companies} staff={staff} /></span>}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">{contacts.length ? "No contacts match." : "No contacts yet."}</p>
      ) : view === "table" ? (
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Client</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Owner</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/admin/contacts/${c.id}`} className="flex items-center gap-2.5 hover:underline">
                    <UserAvatar name={contactName(c)} email={c.email ?? ""} src={null} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{contactName(c)}</span>
                      {c.title && <span className="block truncate text-xs text-muted-foreground">{c.title}</span>}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.company ? <Link href={`/admin/clients/${c.company.id}`} className="hover:underline">{c.company.name}</Link> : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{ownerName(staff, c.owner_id) ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <Link key={c.id} href={`/admin/contacts/${c.id}`} className="space-y-2 rounded-xl border p-4 hover:bg-muted/40">
              <span className="flex items-center gap-3">
                <UserAvatar name={contactName(c)} email={c.email ?? ""} src={null} size="md" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{contactName(c)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[c.title, c.company?.name].filter(Boolean).join(" · ") || "—"}</span>
                </span>
              </span>
              {c.email && <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"><Mail className="size-3" />{c.email}</span>}
              {c.phone && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="size-3" />{c.phone}</span>}
              {c.tags.length > 0 && <span className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
