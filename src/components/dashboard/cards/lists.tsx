"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCheck, PhoneIncoming, PhoneMissed, PhoneOutgoing, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { prettyNumber } from "@/components/redial/phone-center";
import { CARDS } from "@/lib/dashboard/cards";
import type { DashboardData } from "@/lib/dashboard/data";
import { liveCalls, type LiveCall } from "@/lib/redial/actions";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ago, Empty, Frame } from "../kit";

// List cards: notifications (live), what's next, a live call's transcript,
// recent calls, texts and files, and the Live Agents you hired.

type Note = { id: string; title: string; body: string | null; url: string | null; read_at: string | null; created_at: string };

export function NotificationsCard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const channelName = `dash-notes-${useId()}`;
  const [items, setItems] = useState<Note[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let off = false;
    void supabase.from("notifications").select("id, title, body, url, read_at, created_at").eq("user_id", data.userId).eq("show_in_app", true)
      .order("created_at", { ascending: false }).limit(6).then(({ data: rows }) => { if (!off) setItems((rows ?? []) as Note[]); }, () => { if (!off) setItems([]); });
    void supabase.realtime.setAuth().then(() => {
      if (off) return;
      channel = supabase.channel(channelName)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${data.userId}` }, (p) => {
          const n = p.new as Note & { show_in_app: boolean };
          if (n.show_in_app) setItems((list) => [n, ...(list ?? [])].slice(0, 6));
        }).subscribe();
    });
    return () => { off = true; if (channel) supabase.removeChannel(channel); };
  }, [data.userId, channelName]);

  const open = async (n: Note) => {
    if (!n.read_at) {
      setItems((l) => l?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? l);
      await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    }
    if (n.url) router.push(n.url);
  };
  const markAll = async () => {
    setItems((l) => l?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? l);
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", data.userId).is("read_at", null);
  };
  const unread = items?.filter((n) => !n.read_at).length ?? 0;

  return (
    <Frame title="Notifications" icon={CARDS.notifications.icon} href="/notifications"
      action={unread ? <Button variant="ghost" size="icon-sm" onClick={markAll} aria-label="Mark all read" title="Mark all read"><CheckCheck /></Button> : null}>
      {items === null ? <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />)}</div>
        : items.length === 0 ? <Empty>You&apos;re all caught up.</Empty> : (
          <ul className="-mx-1 space-y-0.5">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => open(n)} className="flex w-full gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-muted/60">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-red-600")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", !n.read_at && "font-medium")}>{n.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{n.body ? `${n.body} · ` : ""}{ago(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </Frame>
  );
}

const when = (iso: string, allDay?: boolean) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const day = today ? "Today" : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return allDay ? day : `${day}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
};
const KIND: Record<string, string> = { appointment: "bg-sky-500", event: "bg-violet-500", deadline: "bg-amber-500" };

export function NextUpCard({ data }: { data: DashboardData }) {
  const next = data.calendar.upcoming.find((e) => e.kind === "deadline") ?? data.calendar.upcoming[0];
  const after = data.calendar.upcoming.filter((e) => e.id !== next?.id).slice(0, 3);
  return (
    <Frame title="Next up" icon={CalendarCheck} href="/calendar">
      {!next ? <Empty action={<Link href="/calendar" className="text-xs underline">Open the calendar</Link>}>Nothing coming up.</Empty> : (
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">{next.kind === "deadline" ? "To do" : "Next"} · {when(next.startsAt, next.allDay)}</p>
            <p className="mt-0.5 font-medium">{next.title}</p>
            {next.location && <p className="truncate text-xs text-muted-foreground">{next.location}</p>}
          </div>
          {after.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {after.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", KIND[e.kind] ?? "bg-muted-foreground")} />
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{when(e.startsAt, e.allDay)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Frame>
  );
}

export function LiveCallCard({ data }: { data: DashboardData }) {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const lineIds = data.lineIds.join(",");
  useEffect(() => {
    if (!lineIds) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      let next: LiveCall[] = [];
      if (!document.hidden) {
        for (const id of lineIds.split(",")) {
          try { next = next.concat(await liveCalls(id)); } catch { /* keep going */ }
        }
        if (stopped) return;
        setCalls(next);
      }
      timer = setTimeout(tick, next.length ? 2500 : 15000);
    };
    void tick();
    return () => { stopped = true; clearTimeout(timer); };
  }, [lineIds]);

  const call = calls[0];
  if (!data.hasLine) return <Frame title="Live call" icon={Radio}><Empty>Calls on your Redial line show here as they happen.</Empty></Frame>;
  if (!call) return <Frame title="Live call" icon={Radio} href="/calls"><Empty>No call right now. When one comes in, you&apos;ll see what&apos;s said here, live.</Empty></Frame>;
  const name = call.caller_name || call.caller_id_name || prettyNumber(call.from_number);
  return (
    <Frame title={`Live: ${name}`} icon={Radio} href="/calls" className="border-red-500/50"
      action={<span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" /><span className="relative inline-flex size-2.5 rounded-full bg-red-500" /></span>}>
      <div className="flex max-h-56 flex-col-reverse gap-1.5 overflow-y-auto text-sm">
        {[...call.turns].reverse().slice(0, 12).map((t) => (
          <p key={t.id} className={cn("rounded-xl px-2.5 py-1.5", t.role === "caller" ? "self-start bg-muted" : "self-end bg-primary/10")}>
            <span className="mr-1 text-[10px] font-medium text-muted-foreground uppercase">{t.role === "caller" ? "Caller" : t.role === "assistant" ? "AI" : "You"}</span>{t.text}
          </p>
        ))}
        {!call.turns.length && <p className="text-muted-foreground">{call.status === "ringing" ? "Ringing…" : "Listening…"}</p>}
      </div>
    </Frame>
  );
}

export function RecentCallsCard({ data }: { data: DashboardData }) {
  const calls = data.calls?.recent ?? [];
  return (
    <Frame title="Recent calls" icon={PhoneIncoming} href="/calls?tab=phone">
      {!data.hasLine ? <Empty action={<Link href="/setup" className="text-xs underline">Set up Redial</Link>}>Needs a Redial line.</Empty>
        : !calls.length ? <Empty>No calls yet.</Empty> : (
          <ul className="space-y-1.5 text-sm">
            {calls.slice(0, 6).map((c) => {
              const Icon = c.direction === "outbound" ? PhoneOutgoing : ["missed", "message"].includes(c.status) ? PhoneMissed : PhoneIncoming;
              return (
                <li key={c.id} className="flex items-center gap-2">
                  <Icon className={cn("size-3.5 shrink-0", Icon === PhoneMissed ? "text-red-500" : "text-muted-foreground")} />
                  <span className={cn("min-w-0 flex-1 truncate", c.unread && "font-medium")}>{/^\+?\d+$/.test(c.who) ? prettyNumber(c.who) : c.who}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{ago(c.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
    </Frame>
  );
}

export function RecentTextsCard({ data }: { data: DashboardData }) {
  const texts = data.texts?.recent ?? [];
  return (
    <Frame title="Recent texts" icon={CARDS.recent_texts.icon} href="/sms">
      {!data.hasLine ? <Empty action={<Link href="/setup" className="text-xs underline">Set up Redial</Link>}>Needs a Redial line.</Empty>
        : !texts.length ? <Empty>No texts yet.</Empty> : (
          <ul className="space-y-2 text-sm">
            {texts.map((t) => (
              <li key={t.id} className="min-w-0">
                <p className="flex items-center gap-2"><span className={cn("min-w-0 flex-1 truncate", t.unread && "font-medium")}>{prettyNumber(t.number)}</span><span className="shrink-0 text-xs text-muted-foreground">{ago(t.at)}</span></p>
                <p className="truncate text-xs text-muted-foreground">{t.direction === "outbound" ? "You: " : ""}{t.body}</p>
              </li>
            ))}
          </ul>
        )}
    </Frame>
  );
}

export function RecentFilesCard({ data }: { data: DashboardData }) {
  const files = data.recordings.recent;
  return (
    <Frame title="Recent files" icon={CARDS.recent_files.icon} href="/library/all">
      {!files.length ? <Empty>No recordings yet. Use the red New recording button.</Empty> : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {files.slice(0, 8).map((f) => (
            <li key={f.id}>
              <Link href={`/recordings/${f.id}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/60">
                <span className="min-w-0 flex-1 truncate font-medium">{f.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(f.durationSec)} · {ago(f.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

export function MyAgentsCard({ data }: { data: DashboardData }) {
  return (
    <Frame title="My Live Agents" icon={CARDS.my_agents.icon} href="/agents/mine">
      {!data.agents.length ? <Empty action={<Link href="/agents" className="text-xs underline">Find Live Agents</Link>}>No Live Agents yet.</Empty> : (
        <ul className="space-y-2">
          {data.agents.map((a) => (
            <li key={a.id}>
              <Link href={`/messages/${a.threadId}`} className="flex items-center gap-2.5 rounded-lg p-1 hover:bg-muted/60">
                <AgentAvatar name={a.name} url={a.avatarUrl} online={a.standing === "working"} size="sm" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.name}</span><span className="block text-xs text-muted-foreground capitalize">{a.standing} · {a.work}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
