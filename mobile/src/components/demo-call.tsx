// The welcome screen's short call, from the same script as the website's
// phone (@shared/demo-call): the assistant screens Mike, you take over with
// Gavel, and the rest is recorded. Loops; with reduced motion on, it shows
// the end of the call.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { Bot, Gavel, User } from "lucide-react-native";
import { DEMO_CALL } from "@shared/demo-call";
import { FEATURES } from "@shared/features";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const TICK = 100;

export function DemoCall() {
  const c = useTheme();
  const reduced = useReducedMotion();
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setClock((t) => (t + TICK) % DEMO_CALL.loop), TICK);
    return () => clearInterval(id);
  }, [reduced]);
  const t = reduced ? DEMO_CALL.loop : clock;
  const yours = t >= DEMO_CALL.tookOver;
  const ended = t >= DEMO_CALL.ended;

  return (
    <View style={[s.frame, { backgroundColor: c.card, borderColor: c.border }]} accessibilityLabel="Example: your assistant screens a call from Mike, then you take over.">
      <View style={[s.header, { borderColor: c.border }]}>
        <View style={[s.dot, { backgroundColor: ended ? c.textSecondary : c.live }]} />
        <Text numberOfLines={1} style={[s.headerText, { color: c.text }]}>
          {ended ? "Ended" : "Live"}: {t >= DEMO_CALL.named ? DEMO_CALL.caller : DEMO_CALL.number}
        </Text>
      </View>
      <Text style={[s.status, { color: yours && !ended ? c.live : c.textSecondary }]}>
        {ended ? "Recording and transcript saved" : yours ? "You took over · recording" : "Your assistant is screening"}
      </Text>
      <View style={s.lines}>
        {DEMO_CALL.lines.filter((l) => l.at <= t).slice(-4).map((l) => (
          <Animated.View key={l.at} entering={FadeInDown.duration(300)}
            style={[s.bubble, l.who === "caller" ? { alignSelf: "flex-end", backgroundColor: c.caller } : { backgroundColor: l.who === "you" ? c.you : c.muted }]}>
            {l.who === "ai" ? <Bot size={14} color={c.text} /> : <User size={14} color={c.text} />}
            <Text style={[s.bubbleText, { color: l.who === "you" ? c.youText : c.text }]}>{l.text}</Text>
          </Animated.View>
        ))}
      </View>
      <View style={s.footer}>
        {!yours ? (
          <View style={[s.gavel, { backgroundColor: c.primary, transform: [{ scale: t >= DEMO_CALL.press ? 0.95 : 1 }] }]}>
            <Gavel size={14} color={c.primaryText} />
            <Text style={[s.gavelText, { color: c.primaryText }]}>{t >= DEMO_CALL.press ? "Taking over…" : FEATURES.gavel.action}</Text>
          </View>
        ) : (
          <Text style={[s.status, { color: c.textSecondary }]}>{ended ? "Summary and action items are ready" : "Same call. Mike never redialed."}</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  frame: { borderWidth: 1, borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two, height: 340 },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { flex: 1, fontSize: 14, fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 12, textAlign: "center" },
  lines: { flex: 1, justifyContent: "flex-end", gap: Spacing.two, overflow: "hidden" },
  bubble: { flexDirection: "row", gap: 6, maxWidth: "88%", borderRadius: Radius.medium, paddingHorizontal: 10, paddingVertical: 8 },
  bubbleText: { fontSize: 14, lineHeight: 19, flexShrink: 1 },
  footer: { height: 40, alignItems: "center", justifyContent: "center" },
  gavel: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
  gavelText: { fontSize: 14, fontWeight: "600" },
});
