"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CheckCheck, Mail, MailOpen, Settings } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { LocalDate } from "@/components/local-date";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type NoteRow = { id: string; type: string; title: string; body: string | null; url: string | null; read_at: string | null; created_at: string };

const kind = (t: string) => t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function NotificationsList({ userId, rows: initial }: { userId: string; rows: NoteRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);

  // RLS keeps these updates to your own notifications.
  const mark = async (ids: string[], read: boolean) => {
    const at = read ? new Date().toISOString() : null;
    setRows((list) => list.map((r) => (ids.includes(r.id) ? { ...r, read_at: at } : r)));
    await createClient().from("notifications").update({ read_at: at }).in("id", ids);
    router.refresh();
  };
  const markAll = async () => {
    const at = new Date().toISOString();
    setRows((list) => list.map((r) => ({ ...r, read_at: r.read_at ?? at })));
    await createClient().from("notifications").update({ read_at: at }).eq("user_id", userId).is("read_at", null);
    router.refresh();
  };
  const open = (r: NoteRow) => {
    if (!r.read_at) mark([r.id], true);
    if (r.url) router.push(r.url);
  };
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <CollectionView<NoteRow>
      items={rows} getId={(r) => r.id} title={(r) => r.title} noun={["notification", "notifications"]} storageKey="notifications" defaultView="list"
      empty="You're all caught up."
      subtitle={(r) => r.body}
      media={(r) => (
        <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <Bell className="size-4" />
          {!r.read_at && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-600 ring-2 ring-background" />}
        </span>
      )}
      meta={(r) => <LocalDate iso={r.created_at} short />}
      searchText={(r) => `${r.title} ${r.body ?? ""} ${r.type}`}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "unread", label: "Unread", test: (r) => !r.read_at },
        ...[...new Set(rows.map((r) => r.type))].map((t) => ({ id: `type:${t}`, label: kind(t), test: (r: NoteRow) => r.type === t })),
      ]}
      date={(r) => r.created_at}
      columns={[
        { id: "title", label: "Notification", sort: (r) => r.title.toLowerCase(), cell: (r) => <span className={cn(!r.read_at && "font-medium")}>{r.title}</span> },
        { id: "kind", label: "Kind", sort: (r) => r.type, cell: (r) => <span className="text-muted-foreground">{kind(r.type)}</span> },
        { id: "when", label: "When", sort: (r) => r.created_at, cell: (r) => <span className="text-muted-foreground"><LocalDate iso={r.created_at} short /></span> },
      ]}
      actions={[
        { label: "Mark read", icon: MailOpen, run: (sel) => mark(sel.map((r) => r.id), true), show: (sel) => sel.some((r) => !r.read_at) },
        { label: "Mark unread", icon: Mail, run: (sel) => mark(sel.map((r) => r.id), false), show: (sel) => sel.some((r) => r.read_at) },
      ]}
      onOpen={open}
      toolbar={<>
        <Button variant="outline" disabled={!unread} onClick={markAll}><CheckCheck /> Mark all read</Button>
        <Button variant="ghost" size="icon" aria-label="Notification settings" title="Notification settings" nativeButton={false} render={<Link href="/settings/notifications" />}><Settings /></Button>
      </>}
    />
  );
}
