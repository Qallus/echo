"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; url: string | null; read_at: string | null; created_at: string };

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Bell with an unread count. New notifications arrive live (Realtime, RLS
// limits them to the signed-in user).
export function NotificationBell({ userId, initialUnread, className }: { userId: string; initialUnread: number; className?: string }) {
  const router = useRouter();
  const channelName = `notifications-${useId()}`;
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const n = payload.new as Item & { show_in_app: boolean };
        if (!n.show_in_app) return;
        setUnread((u) => u + 1);
        setItems((list) => (list ? [n, ...list].slice(0, 20) : list));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, channelName]);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("notifications").select("id, title, body, url, read_at, created_at")
      .eq("show_in_app", true).order("created_at", { ascending: false }).limit(20);
    setItems(data ?? []);
  };

  const markAllRead = async () => {
    setUnread(0);
    setItems((list) => list?.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })) ?? list);
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  };

  const openItem = async (item: Item) => {
    setOpen(false);
    if (!item.read_at) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i)) ?? list);
      await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id);
    }
    if (item.url) router.push(item.url);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className={cn("relative", className)} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} />}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          <div className="flex">
            <Button variant="ghost" size="icon-sm" aria-label="Mark all read" title="Mark all read" disabled={!unread} onClick={markAllRead}><CheckCheck /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Notification settings" title="Notification settings" nativeButton={false}
              render={<Link href="/settings/notifications" onClick={() => setOpen(false)} />}><Settings /></Button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items === null ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className="flex w-full gap-3 px-3 py-2.5 text-left hover:bg-muted/60">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-red-600")} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", !n.read_at && "font-medium")}>{n.title}</span>
                      {n.body && <span className="line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                      <span className="block text-[11px] text-muted-foreground">{ago(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
