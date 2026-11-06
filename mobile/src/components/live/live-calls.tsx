// Calls happening right now on a line, like the web's live card
// (src/components/redial/live-calls.tsx): who's calling, the call's state,
// who's on it, the live transcript, and the controls the member's access
// allows: Audible (guide the assistant), Directory (transfer) and Mirror.
// Checks every 15 seconds, every 2.5 while a call is live, and not at all
// while the app is in the background. `onChange` runs when a call starts or
// ends, so the inbox can refresh.
import { useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import { Bot, User } from "lucide-react-native";
import { allows } from "@shared/types";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { get } from "@/lib/api";
import { callerOf } from "@/lib/calls";
import type { LineDetail, LiveCall } from "@/lib/types";
import { Audible } from "./audible";
import { Directory } from "./directory";
import { Mirror } from "./mirror";
import { s } from "./styles";

const IDLE_MS = 15000;
const LIVE_MS = 2500;

export function LiveCalls({ detail, only, onChange }: { detail: LineDetail; only?: string; onChange?: () => void }) {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const liveIds = useRef("");
  const changed = useRef(onChange);
  useEffect(() => { changed.current = onChange; }, [onChange]);
  const lineId = detail.line.id;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      let next: LiveCall[] = [];
      if (AppState.currentState === "active") {
        try { next = (await get<{ calls: LiveCall[] }>("live", { line: lineId })).calls; } catch { next = []; }
        if (stopped) return;
        const ids = next.map((c) => c.id).join(",");
        if (liveIds.current && ids !== liveIds.current) changed.current?.();
        liveIds.current = ids;
        setCalls(next);
      }
      timer = setTimeout(tick, next.length ? LIVE_MS : IDLE_MS);
    };
    void tick();
    // Check straight away when the app comes back to the front.
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") { clearTimeout(timer); void tick(); } });
    return () => { stopped = true; clearTimeout(timer); sub.remove(); };
  }, [lineId]);

  const shown = only ? calls.filter((c) => c.id === only) : calls;
  if (!shown.length) return null;
  return <View style={{ gap: Spacing.three, paddingBottom: Spacing.three }}>{shown.map((c) => <LiveCard key={c.id} call={c} detail={detail} />)}</View>;
}

function LiveCard({ call: c, detail }: { call: LiveCall; detail: LineDetail }) {
  const t = useTheme();
  const { line, directory, mirror } = detail;
  const a = line.access;
  const now = useNow();
  const seconds = Math.max(0, Math.floor((now - new Date(c.started_at).getTime()) / 1000));
  const live = c.session?.state === "live";
  const aiOnCall = c.status === "screening" && (!c.session || (!c.session.taken_over && ["pending", "joining", "active"].includes(c.session.ai_state)));
  const onCall = c.session?.participants.filter((p) => p.status === "joined") ?? [];

  return (
    <View style={[s.card, { borderColor: t.live, backgroundColor: t.card }]} accessibilityLabel={`Live call from ${callerOf(c)}`}>
      <View style={s.row}>
        <View style={[s.dot, { backgroundColor: t.live }]} />
        <Text numberOfLines={1} style={[s.title, { color: t.text }]}>Live: {callerOf(c)}</Text>
        <Text style={[s.small, { color: t.textSecondary, fontVariant: ["tabular-nums"] }]}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</Text>
      </View>
      <Text style={[s.small, { color: t.textSecondary }]}>{stateLabel(c, line.assistant_name)}</Text>
      {onCall.length > 0 && (
        <View style={s.people}>
          {onCall.map((p) => (
            <Text key={p.id} style={[s.person, { borderColor: t.border, color: t.text }]}>
              {p.role === "agent" ? line.assistant_name : p.role === "caller" ? "Caller" : p.role === "transfer" ? "Transfer recipient" : `${p.me ? "You" : "Team member"} (${p.muted ? "listening" : "speaking"})`}
            </Text>
          ))}
        </View>
      )}

      {allows(a, "read_transcript") ? <Transcript turns={c.turns} assistant={line.assistant_name} /> : (
        <Text style={[s.small, { color: t.textSecondary }]}>The live transcript is only shown to people the owner lets read transcripts.</Text>
      )}
      {allows(a, "direct_agent") && aiOnCall && <Audible callId={c.id} assistant={line.assistant_name} directions={c.directions} />}
      {allows(a, "transfer_call") && live && (
        <Directory callId={c.id} assistant={line.assistant_name} directory={directory} canCustom={allows(a, "dial_custom_destination")} transfers={c.transfers} />
      )}
      {allows(a, "mirror") && mirror.enabled && (c.status === "connecting" || c.status === "connected") && (
        <Mirror callId={c.id} callerNumber={c.from_number} mirror={c.mirror} suggestions={c.suggestions} />
      )}
    </View>
  );
}

function stateLabel(c: LiveCall, assistant: string) {
  if (c.status === "connecting") return "Ringing you";
  if (c.status === "ringing") return "Ringing";
  if (c.session?.taken_over) return c.session.taken_over === "me" ? "You took over" : "A team member took over";
  const ai = c.session?.ai_state;
  if (ai === "pending" || ai === "joining") return `Connecting ${assistant}`;
  if (ai === "left" || ai === "failed") return "Wrapping up";
  return `${assistant} is talking with the caller`;
}

// The last few lines of the conversation, newest at the bottom.
function Transcript({ turns, assistant }: { turns: LiveCall["turns"]; assistant: string }) {
  const t = useTheme();
  if (!turns.length) return <Text style={[s.small, { color: t.textSecondary }]}>Waiting for the first words…</Text>;
  return (
    <View style={{ gap: Spacing.two }} accessibilityLiveRegion="polite">
      {turns.slice(-6).map((x) => (
        <View key={x.id} style={[s.bubble, x.role === "caller" ? { alignSelf: "flex-end", backgroundColor: t.caller } : { backgroundColor: t.muted }]}>
          {x.role === "assistant" ? <Bot size={14} color={t.textSecondary} /> : <User size={14} color={t.textSecondary} />}
          <View style={{ flexShrink: 1 }}>
            <Text style={[s.who, { color: t.textSecondary }]}>{x.role === "assistant" ? assistant : x.role === "person" ? "Your side" : "Caller"}</Text>
            <Text style={{ color: t.text, fontSize: 15, lineHeight: 21 }}>{x.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return now;
}
