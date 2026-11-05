import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { AudioLines } from "lucide-react-native";
import { Body, Button, ErrorText, Loading, Screen, Title } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { get } from "@/lib/api";
import { ago, duration } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import type { RecordingRow } from "@/lib/types";

// Echo inside Redial: every recording from the member's workspaces.
export default function EchoTab() {
  const c = useTheme();
  const data = useLoad(() => get<{ recordings: RecordingRow[]; workspaces: { id: string; name: string; isPersonal: boolean }[] }>("recordings"), "recordings");
  if (data.loading) return <Loading />;
  if (data.error) return <Screen><ErrorText>{data.error}</ErrorText><Button title="Try again" onPress={() => data.reload()} /></Screen>;
  const space = (id: string) => {
    const w = data.data?.workspaces.find((x) => x.id === id);
    return w ? (w.isPersonal ? "Personal" : w.name) : "";
  };

  return (
    <Screen scroll={false} edges={["top"]} style={{ paddingBottom: 0 }}>
      <Title>Echo</Title>
      <FlatList
        data={data.data?.recordings ?? []}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => data.reload(true)} tintColor={c.text} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: 10, paddingTop: 40 }}>
            <AudioLines size={28} color={c.textSecondary} />
            <Body style={{ fontWeight: "600" }}>No recordings yet</Body>
            <Body muted style={{ textAlign: "center" }}>Record a meeting or call in Echo on the web, and its transcript and summary show up here.</Body>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/recording/[id]", params: { id: item.id } })}
            style={({ pressed }) => [{ paddingVertical: Spacing.three, gap: 2 }, pressed && { opacity: 0.6 }]}>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>
              {[ago(item.createdAt), item.durationSec ? duration(item.durationSec) : null, space(item.workspaceId), item.status === "processing" ? "Transcribing…" : null].filter(Boolean).join(" · ")}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}
