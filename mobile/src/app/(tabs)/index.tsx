import { useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { PhoneOff } from "lucide-react-native";
import { Body, Button, ErrorText, Loading, Screen, Title } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { get } from "@/lib/api";
import { callerOf } from "@/lib/calls";
import { ago } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import type { Call, LineData, Me } from "@/lib/types";

// The call inbox for one line (with a switcher when there are several).
export default function Calls() {
  const c = useTheme();
  const me = useLoad(() => get<Me>("me"), "me");
  const [picked, setPicked] = useState<string | null>(null);
  const lineId = picked ?? me.data?.lines[0]?.id ?? null;
  const line = useLoad(() => (lineId ? get<LineData>("line", { line: lineId }) : Promise.resolve(null)), lineId ?? "");

  if (me.loading) return <Loading />;
  if (me.error) return <Screen><ErrorText>{me.error}</ErrorText><Button title="Try again" onPress={() => me.reload()} /></Screen>;
  if (!me.data?.lines.length) {
    return (
      <Screen>
        <Title>Calls</Title>
        <View style={{ alignItems: "center", gap: 10, paddingTop: 40 }}>
          <PhoneOff size={28} color={c.textSecondary} />
          <Body style={{ fontWeight: "600" }}>No Redial number yet</Body>
          <Body muted style={{ textAlign: "center" }}>We&apos;re setting up your number. Calls appear here as soon as your assistant answers one.</Body>
        </View>
      </Screen>
    );
  }

  const calls = (line.data?.calls ?? []).filter((x) => !x.archived_at);
  return (
    <Screen scroll={false} edges={["top"]} style={{ paddingBottom: 0 }}>
      <Title>Calls</Title>
      {me.data.lines.length > 1 && (
        <View style={s.chips}>
          {me.data.lines.map((l) => (
            <Pressable key={l.id} onPress={() => setPicked(l.id)} accessibilityRole="button" accessibilityState={{ selected: l.id === lineId }}
              style={[s.chip, { borderColor: l.id === lineId ? c.primary : c.border, backgroundColor: l.id === lineId ? c.primary : "transparent" }]}>
              <Text style={{ color: l.id === lineId ? c.primaryText : c.text, fontSize: 13 }}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <ErrorText>{line.error}</ErrorText>
      <FlatList
        data={calls}
        keyExtractor={(x) => x.id}
        refreshControl={<RefreshControl refreshing={line.refreshing} onRefresh={() => line.reload(true)} tintColor={c.text} />}
        ListEmptyComponent={line.loading ? <Loading /> : <Body muted style={{ textAlign: "center", paddingTop: 40 }}>No calls yet. They show up here as your assistant takes them.</Body>}
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/call/[id]", params: { id: item.id, line: item.line_id } })}
            style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
            <View style={[s.unread, { backgroundColor: item.read_at ? "transparent" : c.live }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "baseline" }}>
                <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: item.read_at ? "500" : "700" }}>{callerOf(item)}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 12 }}>{ago(item.started_at)}</Text>
              </View>
              <Text numberOfLines={2} style={{ color: c.textSecondary, fontSize: 14, lineHeight: 19 }}>
                {item.urgency === "high" ? "Urgent · " : ""}{item.summary || item.message || item.reason || statusText(item.status)}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function statusText(status: Call["status"]) {
  return ({ ringing: "Ringing…", screening: "Your assistant is answering…", connecting: "Putting the call through…", connected: "Put through to you", blocked: "Blocked", forwarded: "Forwarded", missed: "Missed", failed: "Didn't connect", message: "Message taken", completed: "Finished" } as const)[status];
}

const s = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  row: { flexDirection: "row", gap: Spacing.three, paddingVertical: Spacing.three },
  unread: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
});
