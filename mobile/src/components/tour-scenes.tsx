// The feature tour's animated scenes, one per card. Each plays while its card
// is showing, then holds its last frame; with reduced motion on, it shows the
// last frame straight away. Names come from @shared/features.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { Bot, Check, FileText, Gavel, Headphones, MessageSquareLock, PhoneForwarded, Sparkles, User } from "lucide-react-native";
import { FEATURES } from "@shared/features";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

// ms since the card became active (capped at `end`). The tour remounts a
// scene each time its card becomes active, so it starts from 0.
function useClock(active: boolean, end: number) {
  const reduced = useReducedMotion();
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active || reduced) return;
    const id = setInterval(() => setT((x) => (x + 100 >= end ? end : x + 100)), 100);
    return () => clearInterval(id);
  }, [active, reduced, end]);
  return reduced ? end : t;
}

function Bubble({ who, children }: { who: "ai" | "caller" | "you"; children: string }) {
  const c = useTheme();
  const bg = who === "caller" ? c.caller : who === "you" ? c.you : c.muted;
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={[s.bubble, { backgroundColor: bg }, who === "caller" && { alignSelf: "flex-end" }]}>
      {who === "ai" ? <Bot size={14} color={c.text} /> : <User size={14} color={c.text} />}
      <Text style={[s.text, { color: who === "you" ? c.youText : c.text }]}>{children}</Text>
    </Animated.View>
  );
}

function Chip({ icon, children, tone = "plain" }: { icon?: React.ReactNode; children: string; tone?: "plain" | "you" | "dark" }) {
  const c = useTheme();
  const bg = tone === "you" ? c.you : tone === "dark" ? c.primary : c.muted;
  const fg = tone === "you" ? c.youText : tone === "dark" ? c.primaryText : c.text;
  return <Animated.View entering={FadeInDown.duration(300)} style={[s.chip, { backgroundColor: bg }]}>{icon}<Text style={[s.chipText, { color: fg }]}>{children}</Text></Animated.View>;
}

function Bar({ i, active }: { i: number; active: boolean }) {
  const c = useTheme();
  const reduced = useReducedMotion();
  const h = useSharedValue(0.4);
  useEffect(() => {
    h.value = active && !reduced ? withDelay(i * 60, withRepeat(withTiming(0.3 + ((i * 37) % 70) / 100, { duration: 420 }), -1, true)) : 0.4 + ((i * 37) % 60) / 100;
  }, [active, reduced, i, h]);
  const style = useAnimatedStyle(() => ({ height: `${Math.min(1, h.value) * 100}%` }));
  return <Animated.View style={[{ flex: 1, borderRadius: 3, backgroundColor: c.text }, style]} />;
}

function Screening({ active }: { active: boolean }) {
  const t = useClock(active, 3200);
  return (
    <View style={s.col}>
      {t >= 200 && <Bubble who="ai">Hi, this is DJ, Jordan&apos;s assistant. Who&apos;s calling, and what&apos;s it about?</Bubble>}
      {t >= 1400 && <Bubble who="caller">It&apos;s Dana from Summit Roofing, about tomorrow&apos;s install.</Bubble>}
      {t >= 2600 && <Chip>Message taken · summary sent to you</Chip>}
    </View>
  );
}

function Insider({ active }: { active: boolean }) {
  const c = useTheme();
  return (
    <View style={[s.col, { justifyContent: "center" }]}>
      <Chip icon={<Headphones size={14} color={c.text} />}>Listening · you&apos;re muted</Chip>
      <View style={s.wave}>{Array.from({ length: 22 }, (_, i) => <Bar key={i} i={i} active={active} />)}</View>
      <Text style={[s.text, { color: c.textSecondary, textAlign: "center" }]}>Dana can&apos;t hear you. Your assistant keeps talking.</Text>
    </View>
  );
}

function Audible({ active }: { active: boolean }) {
  const c = useTheme();
  const t = useClock(active, 3400);
  return (
    <View style={s.col}>
      <View style={[s.card, { borderColor: c.border }]}>
        <View style={s.row}><MessageSquareLock size={14} color={c.text} /><Text style={[s.small, { color: c.textSecondary }]}>Private direction · the caller can&apos;t see it</Text></View>
        <Text style={[s.text, { color: c.text }]}>Ask what time the crew should arrive.</Text>
        {t >= 900 && <Chip tone={t >= 1900 ? "you" : "plain"} icon={t >= 1900 ? <Check size={14} color={c.youText} /> : undefined}>{t >= 1900 ? "Delivered" : "Waiting for a pause"}</Chip>}
      </View>
      {t >= 2400 && <Bubble who="ai">One more thing, Dana: what time should the crew arrive?</Bubble>}
    </View>
  );
}

function GavelScene({ active }: { active: boolean }) {
  const c = useTheme();
  const t = useClock(active, 3400);
  return (
    <View style={[s.col, { justifyContent: "center" }]}>
      {t < 1500
        ? <Chip tone="dark" icon={<Gavel size={14} color={c.primaryText} />}>{t >= 800 ? "Taking over…" : FEATURES.gavel.action}</Chip>
        : <Chip tone="you">You&apos;re on the call. Your assistant left.</Chip>}
      {t >= 2200 && <Bubble who="you">Hi Dana, it&apos;s Jordan. Yes, 8am works.</Bubble>}
      <Text style={[s.small, { color: c.textSecondary, textAlign: "center" }]}>Same call. Dana never hangs up.</Text>
    </View>
  );
}

function DirectoryMirror({ active }: { active: boolean }) {
  const c = useTheme();
  const t = useClock(active, 4200);
  return (
    <View style={s.col}>
      <View style={[s.card, { borderColor: c.border }]}>
        <View style={s.row}><PhoneForwarded size={14} color={c.text} /><Text style={[s.text, { color: c.text, fontWeight: "600" }]}>{FEATURES.directory.name}: Office</Text></View>
        <Text style={[s.small, { color: c.textSecondary }]}>{t >= 1500 ? "Connected. They pressed 1." : "Ringing… they hear who's calling, then press 1."}</Text>
      </View>
      {t >= 2200 && (
        <Animated.View entering={FadeInDown.duration(300)} style={[s.card, { borderColor: c.border }]}>
          <View style={s.row}><Sparkles size={14} color={c.text} /><Text style={[s.text, { color: c.text, fontWeight: "600" }]}>{FEATURES.mirror.name} suggests</Text></View>
          <Text style={[s.small, { color: c.textSecondary }]}>Installs carry a 10-year workmanship warranty. (From your notes)</Text>
        </Animated.View>
      )}
    </View>
  );
}

function Echo({ active }: { active: boolean }) {
  const c = useTheme();
  const t = useClock(active, 3600);
  return (
    <View style={s.col}>
      {t >= 200 && <Text style={[s.small, { color: c.text }]}>0:12  <Text style={{ fontWeight: "700" }}>Jordan:</Text> Let&apos;s lock the launch for the 14th.</Text>}
      {t >= 900 && <Text style={[s.small, { color: c.text }]}>0:19  <Text style={{ fontWeight: "700" }}>Priya:</Text> I&apos;ll have the deck ready Friday.</Text>}
      {t >= 1700 && (
        <Animated.View entering={FadeInDown.duration(300)} style={[s.card, { borderColor: c.border }]}>
          <View style={s.row}><FileText size={14} color={c.text} /><Text style={[s.text, { color: c.text, fontWeight: "600" }]}>Summary</Text></View>
          <Text style={[s.small, { color: c.textSecondary }]}>Launch set for the 14th. Deck due Friday.</Text>
          {t >= 2600 && <Text style={[s.small, { color: c.text }]}>☐ Priya: finish the launch deck</Text>}
        </Animated.View>
      )}
    </View>
  );
}

export const TOUR = [
  { title: "Your assistant answers", text: "Unknown callers talk to your assistant first. It finds out who's calling and why, then takes a message or puts them through.", Scene: Screening },
  { title: `${FEATURES.insider.name}: listen in`, text: "Hear any call live. You're muted by the phone system, so nobody knows you're there.", Scene: Insider },
  { title: `${FEATURES.audible.name}: guide it`, text: "Type a private direction and your assistant works it in at the next pause. The caller never sees it.", Scene: Audible },
  { title: `${FEATURES.gavel.name}: take over`, text: "Take the call yourself, on the same call. Your assistant steps away.", Scene: GavelScene },
  { title: `${FEATURES.directory.name} and ${FEATURES.mirror.name}`, text: "Transfer a caller to someone you trust, and get suggestions from your notes while you talk.", Scene: DirectoryMirror },
  { title: "Echo, built in", text: "Record meetings and calls, get transcripts, summaries and action items, and ask questions about any of it.", Scene: Echo },
];

const s = StyleSheet.create({
  col: { flex: 1, gap: Spacing.two, justifyContent: "flex-end" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  bubble: { flexDirection: "row", gap: 6, maxWidth: "90%", borderRadius: Radius.medium, paddingHorizontal: 10, paddingVertical: 8 },
  text: { fontSize: 14, lineHeight: 19, flexShrink: 1 },
  small: { fontSize: 13, lineHeight: 18 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: "600" },
  wave: { height: 64, flexDirection: "row", alignItems: "center", gap: 4 },
  card: { borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three, gap: 6 },
});
