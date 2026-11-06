// The welcome screen's short call (script: @/lib/welcome-call): a blocked
// number rings, Redial slides to answer, you listen in with Insider and steer
// the assistant with Audible, and the call ends without you picking up.
// Loops; with reduced motion on, it shows the end of the call.
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { Bot, Headphones, Lock, MessageSquare, Phone, PhoneIncoming, User } from "lucide-react-native";
import { FEATURES } from "@shared/features";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { PRESS, WELCOME_CALL as CALL } from "@/lib/welcome-call";

const TICK = 100;
const TRACK = 240;
const THUMB = 36;

export function DemoCall() {
  const c = useTheme();
  const reduced = useReducedMotion();
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setClock((t) => (t + TICK) % CALL.loop), TICK);
    return () => clearInterval(id);
  }, [reduced]);
  const t = reduced ? CALL.loop : clock;
  const ringing = t < CALL.answered;
  const listening = t >= CALL.listen;
  const ended = t >= CALL.ended;
  const who = t >= CALL.named ? CALL.caller : CALL.number;

  const status = ended ? "Call ended · transcript saved"
    : listening ? `${FEATURES.insider.name} · you're listening. Dave can't hear you.`
    : !ringing ? "Your assistant is screening"
    : t >= CALL.slide ? "Redial is answering" : "Ringing…";

  return (
    <View style={[s.frame, { backgroundColor: c.card, borderColor: c.border }]} accessibilityLabel="Example: Redial answers a blocked number about solar panels. You listen in, tell your assistant you're not interested, and never pick up.">
      <View style={[s.header, { borderColor: c.border }]}>
        <View style={[s.dot, { backgroundColor: ended ? c.textSecondary : c.live }]} />
        <Text numberOfLines={1} style={[s.headerText, { color: c.text }]}>
          {ringing ? "Incoming call" : ended ? "Ended" : "Live"}: {who}
        </Text>
      </View>
      <Text style={[s.status, { color: listening && !ended ? c.live : c.textSecondary }]}>{status}</Text>

      {ringing ? (
        <View style={s.ringing}>
          <View style={[s.avatar, { backgroundColor: c.muted }]}><PhoneIncoming size={26} color={c.text} /></View>
          <Text style={[s.ringingName, { color: c.text }]}>{CALL.number}</Text>
        </View>
      ) : (
        <View style={s.lines}>
          {CALL.lines.filter((l) => l.at <= t).slice(-3).map((l) => (
            <Animated.View key={l.at} entering={FadeInDown.duration(300)} style={[s.bubble, bubbleStyle(l.who, c)]}>
              {l.who === "ai" ? <Bot size={14} color={c.text} /> : l.who === "note" ? <Lock size={14} color={c.textSecondary} /> : <User size={14} color={c.text} />}
              <View style={{ flexShrink: 1 }}>
                {l.who === "note" && <Text style={[s.noteLabel, { color: c.textSecondary }]}>{FEATURES.audible.name} · to your assistant only</Text>}
                <Text style={[s.bubbleText, { color: c.text }]}>{l.text}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      )}

      <View style={s.footer}>
        {ringing ? <AnswerSlider sliding={t >= CALL.slide} />
          : t < CALL.listen ? (
            <Control pressed={t >= CALL.listen - PRESS} icon={<Headphones size={14} color={c.primaryText} />}
              label={t >= CALL.listen - PRESS ? "Connecting…" : FEATURES.insider.action} />
          ) : t < CALL.guide ? (
            <Control pressed={t >= CALL.guide - PRESS} icon={<MessageSquare size={14} color={c.primaryText} />}
              label={t >= CALL.guide - PRESS ? "Sending…" : FEATURES.audible.action} />
          ) : (
            <Text style={[s.status, { color: c.textSecondary }]}>
              {ended ? "You never picked up. The summary is in Calls." : "Dave only hears your assistant."}
            </Text>
          )}
      </View>
    </View>
  );
}

function bubbleStyle(who: "ai" | "caller" | "note", c: ReturnType<typeof useTheme>) {
  if (who === "caller") return { alignSelf: "flex-end" as const, backgroundColor: c.caller };
  if (who === "note") return { borderWidth: 1, borderStyle: "dashed" as const, borderColor: c.border };
  return { backgroundColor: c.muted };
}

// "Slide to answer", with Redial's thumb doing the sliding.
function AnswerSlider({ sliding }: { sliding: boolean }) {
  const c = useTheme();
  const x = useSharedValue(0);
  useEffect(() => { x.set(sliding ? withTiming(TRACK - THUMB - 8, { duration: 1000 }) : 0); }, [sliding, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <View style={[s.track, { backgroundColor: c.muted }]}>
      <Text style={[s.trackText, { color: c.textSecondary }]}>{sliding ? "Redial is answering" : "slide to answer"}</Text>
      <Animated.View style={[s.thumb, { backgroundColor: c.youText }, thumb]}>
        <Phone size={16} color={c.you} />
      </Animated.View>
    </View>
  );
}

function Control({ pressed, icon, label }: { pressed: boolean; icon: ReactNode; label: string }) {
  const c = useTheme();
  return (
    <View style={[s.control, { backgroundColor: c.primary, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
      {icon}
      <Text style={[s.controlText, { color: c.primaryText }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  frame: { borderWidth: 1, borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two, height: 360 },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { flex: 1, fontSize: 14, fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 12, textAlign: "center" },
  ringing: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.two },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  ringingName: { fontSize: 18, fontWeight: "600" },
  lines: { flex: 1, justifyContent: "flex-end", gap: Spacing.two, overflow: "hidden" },
  bubble: { flexDirection: "row", gap: 6, maxWidth: "88%", borderRadius: Radius.medium, paddingHorizontal: 10, paddingVertical: 8 },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  noteLabel: { fontSize: 11, fontWeight: "600", marginBottom: 1 },
  footer: { height: 48, alignItems: "center", justifyContent: "center" },
  track: { width: TRACK, height: THUMB + 8, borderRadius: Radius.pill, justifyContent: "center", paddingHorizontal: 4 },
  trackText: { position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 13 },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, alignItems: "center", justifyContent: "center" },
  control: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
  controlText: { fontSize: 14, fontWeight: "600" },
});
