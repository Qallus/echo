"use client";

import { useState, useTransition } from "react";
import { Copy, MailCheck, MailX, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollectionView } from "@/components/collection/collection-view";
import { DetailList, IconTile, muted } from "@/components/collection/kit";
import { deleteAudience, resubscribe } from "@/lib/admin/actions/comms";
import { audienceLabel } from "@/lib/comms/audience";
import type { SavedAudience, Unsubscribe } from "@/lib/comms/data";
import { EmptyState } from "@/components/admin/crm/crm-kit";

// Email → Audiences and Email → Unsubscribes, in the shared list layout.

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
type Result = { ok?: string; error?: string };

function useRun() {
  const [msg, setMsg] = useState<Result>({});
  const [pending, start] = useTransition();
  const many = <T,>(rows: T[], fn: (r: T) => Promise<Result>) => start(async () => {
    let last: Result = {};
    for (const r of rows) { last = await fn(r); if (last.error) break; }
    setMsg(last);
  });
  const note = (msg.ok || msg.error) ? <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p> : null;
  return { many, pending, note };
}

export function AudienceList({ audiences, readOnly }: { audiences: SavedAudience[]; readOnly: boolean }) {
  const { many, pending, note } = useRun();
  if (!audiences.length) return <EmptyState message="No saved audiences yet. Build one on the Send tab (Audience) and save it with a name." />;
  const remove = (rows: SavedAudience[]) => confirm(rows.length === 1 ? `Delete the audience "${rows[0].name}"? Nobody is unsubscribed.` : `Delete ${rows.length} audiences? Nobody is unsubscribed.`) && many(rows, (a) => deleteAudience(a.id));
  return (
    <div className="space-y-3">
      {note}
      <CollectionView<SavedAudience>
        items={audiences} getId={(a) => a.id} title={(a) => a.name} noun={["audience", "audiences"]} storageKey="admin-email-audiences" defaultView="list"
        subtitle={(a) => audienceLabel(a.definition)} media={() => <IconTile icon={Users} />} meta={(a) => `Updated ${when(a.updated_at)}`}
        searchText={(a) => `${a.name} ${a.description ?? ""} ${audienceLabel(a.definition)}`}
        date={(a) => a.updated_at}
        columns={[
          { id: "name", label: "Name", sort: (a) => a.name.toLowerCase(), cell: (a) => <span className="font-medium">{a.name}</span> },
          { id: "who", label: "Who's in it", cell: (a) => <span className="block max-w-md truncate text-muted-foreground">{audienceLabel(a.definition)}</span> },
          { id: "updated", label: "Updated", sort: (a) => a.updated_at, cell: (a) => muted(when(a.updated_at)) },
        ]}
        actions={readOnly ? [] : [{ label: "Delete", icon: Trash2, destructive: true, run: remove }]}
        previewActions={(a) => !readOnly && <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove([a])}><Trash2 /> Delete</Button>}
        preview={(a) => (
          <div className="space-y-3 text-sm">
            {a.description && <p className="text-muted-foreground">{a.description}</p>}
            <DetailList rows={[["Who's in it", audienceLabel(a.definition)], ["Updated", when(a.updated_at)]]} />
            <p className="text-xs text-muted-foreground">Use it from the Send tab: Audience → Saved audiences.</p>
          </div>
        )}
      />
    </div>
  );
}

const REASON: Record<Unsubscribe["reason"], { label: string; title: string }> = {
  unsubscribed: { label: "Unsubscribed", title: "They clicked unsubscribe" },
  bounced: { label: "Bounced", title: "The address doesn't exist or rejected the email permanently" },
  complained: { label: "Marked as spam", title: "They marked an email as spam" },
};

export function UnsubscribeList({ unsubscribes, readOnly }: { unsubscribes: Unsubscribe[]; readOnly: boolean }) {
  const { many, pending, note } = useRun();
  if (!unsubscribes.length) return <EmptyState message="No one has unsubscribed." />;
  const badge = (u: Unsubscribe) => <Badge variant="outline" className={u.reason !== "unsubscribed" ? "text-destructive" : undefined} title={REASON[u.reason].title}>{REASON[u.reason].label}</Badge>;
  const back = (rows: Unsubscribe[]) => {
    const ok = rows.length === 1
      ? confirm(rows[0].reason === "bounced" ? `Only do this if you've confirmed ${rows[0].email} works again. Sending to addresses that bounce hurts delivery for everyone.` : `Only do this if ${rows[0].email} asked to receive emails again.`)
      : confirm(`Resubscribe ${rows.length} addresses? Only do this if each one asked to receive emails again (and bounced addresses work again).`);
    if (ok) many(rows, (u) => resubscribe(u.email));
  };
  return (
    <div className="space-y-3">
      {note}
      <CollectionView<Unsubscribe>
        items={unsubscribes} getId={(u) => u.email} title={(u) => u.email} noun={["address", "addresses"]} storageKey="admin-email-unsubscribes" defaultView="table"
        media={(u) => <IconTile icon={u.reason === "unsubscribed" ? MailX : MailCheck} />} badge={badge} meta={(u) => when(u.created_at)}
        searchText={(u) => `${u.email} ${REASON[u.reason].label}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "unsubscribed", label: "Unsubscribed", test: (u) => u.reason === "unsubscribed" },
          { id: "bounced", label: "Bounced", test: (u) => u.reason === "bounced" },
          { id: "complained", label: "Marked as spam", test: (u) => u.reason === "complained" },
        ]}
        date={(u) => u.created_at}
        columns={[
          { id: "email", label: "Email", sort: (u) => u.email, cell: (u) => <span className="font-medium">{u.email}</span> },
          { id: "reason", label: "Why", sort: (u) => u.reason, cell: badge },
          { id: "when", label: "When", sort: (u) => u.created_at, cell: (u) => muted(when(u.created_at)) },
        ]}
        actions={[
          { label: "Copy addresses", icon: Copy, run: (rows) => { void navigator.clipboard.writeText(rows.map((u) => u.email).join(", ")); } },
          ...(readOnly ? [] : [{ label: "Resubscribe", icon: MailCheck, run: back }]),
        ]}
        previewActions={(u) => !readOnly && <Button size="sm" variant="outline" disabled={pending} onClick={() => back([u])}><MailCheck /> Resubscribe</Button>}
        preview={(u) => <DetailList rows={[["Why", `${REASON[u.reason].label}: ${REASON[u.reason].title.toLowerCase()}`], ["When", when(u.created_at)]]} />}
      />
    </div>
  );
}
