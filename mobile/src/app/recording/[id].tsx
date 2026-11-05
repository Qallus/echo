import { useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { Body, Card, ErrorText, Label, Loading, Screen } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { get, post } from "@/lib/api";
import { ago, clock, duration } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import type { RecordingDetail } from "@/lib/types";

// One Echo recording: summary, action items (tick them off) and transcript.
export default function RecordingScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useLoad(() => get<RecordingDetail>("recording", { id }), id);
  if (data.loading) return <Loading />;
  if (!data.data) return <Screen><ErrorText>{data.error}</ErrorText></Screen>;
  const { recording: r, summary, segments } = data.data;

  const toggle = (itemId: string, done: boolean) => {
    data.setData((d) => d && d.summary ? { ...d, summary: { ...d.summary, actionGroups: d.summary.actionGroups.map((g) => ({ ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, done } : i)) })) } } : d);
    post("action-items.toggle", { id: itemId, done }).catch(() => data.reload());
  };

  return (
    <Screen edges={["bottom"]}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>{r.title}</Text>
        <Body muted>{[ago(r.createdAt), r.durationSec ? duration(r.durationSec) : null].filter(Boolean).join(" · ")}</Body>
      </View>
      {summary ? (
        <Card style={{ gap: 8 }}>
          <Label>Summary</Label>
          {summary.overview ? <Body>{summary.overview}</Body> : null}
          {summary.keyPoints.map((k, i) => <Body key={i}>• {k}</Body>)}
        </Card>
      ) : <Body muted>{r.status === "processing" ? "Transcribing. The summary appears when it's done." : "No summary yet."}</Body>}

      {summary?.actionGroups.some((g) => g.items.length) && (
        <View style={{ gap: 8 }}>
          <Label>Action items</Label>
          {summary.actionGroups.flatMap((g) => g.items.map((i) => (
            <Pressable key={i.id} accessibilityRole="checkbox" accessibilityState={{ checked: i.done }} onPress={() => toggle(i.id, !i.done)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.border, backgroundColor: i.done ? c.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                {i.done && <Check size={14} color={c.primaryText} />}
              </View>
              <Text style={{ flex: 1, color: i.done ? c.textSecondary : c.text, fontSize: 15, lineHeight: 21, textDecorationLine: i.done ? "line-through" : "none" }}>
                {i.text}{g.owner && g.owner !== "Unassigned" ? <Text style={{ color: c.textSecondary }}> · {g.owner}</Text> : null}
              </Text>
            </Pressable>
          )))}
        </View>
      )}

      {segments.length > 0 && (
        <View style={{ gap: 10 }}>
          <Label>Transcript</Label>
          {segments.map((g, i) => (
            <Text key={i} style={{ color: c.text, fontSize: 15, lineHeight: 22 }}>
              <Text style={{ color: c.textSecondary, fontVariant: ["tabular-nums"] }}>{clock(g.startSec)}  </Text>
              <Text style={{ fontWeight: "700" }}>{g.speaker}: </Text>{g.text}
            </Text>
          ))}
        </View>
      )}
    </Screen>
  );
}
