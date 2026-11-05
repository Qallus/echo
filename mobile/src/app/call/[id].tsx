import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Linking, Text, View } from "react-native";
import { Ban, PhoneCall, Star } from "lucide-react-native";
import { allows } from "@shared/types";
import { Body, Button, Card, ErrorText, Label, Loading, Screen } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { get, post } from "@/lib/api";
import { callerOf } from "@/lib/calls";
import { ago, duration, phone } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import type { LineData, Me } from "@/lib/types";

// One call: the summary or message, the transcript (when the member may read
// it), call back, and quick Block or VIP. Opening it marks it read.
export default function CallDetail() {
  const c = useTheme();
  const { id, line } = useLocalSearchParams<{ id: string; line?: string }>();
  const data = useLoad(async () => {
    // From a notification there's no line id: find the line that has the call.
    const ids = line ? [line] : (await get<Me>("me")).lines.map((l) => l.id);
    for (const l of ids) {
      const d = await get<LineData>("line", { line: l });
      const call = d.calls.find((x) => x.id === id);
      if (call) return { d, call };
    }
    throw new Error("This call isn't available.");
  }, `${id}:${line ?? ""}`);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = data.data?.call;
  useEffect(() => { if (call && !call.read_at) post("calls.update", { id: call.id, patch: { read: true } }).catch(() => {}); }, [call]);

  if (data.loading) return <Loading />;
  if (!data.data || !call) return <Screen><ErrorText>{data.error}</ErrorText></Screen>;
  const { d } = data.data;
  const number = call.callback_number || call.from_number;
  const canRules = allows(d.line.access, "manage_rules");
  const listed = d.entries.find((e) => e.number === call.from_number);

  const addTo = async (kind: "block" | "vip") => {
    setError(null); setNotice(null);
    try {
      const r = await post("lists.add", { lineId: d.line.id, number: call.from_number, kind, label: call.caller_name ?? "" });
      setNotice(r.ok ?? "Done.");
      data.reload();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Screen edges={["bottom"]}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>{callerOf(call)}</Text>
        <Body muted>{[phone(call.from_number), ago(call.started_at), call.duration_seconds ? duration(call.duration_seconds) : null].filter(Boolean).join(" · ")}</Body>
      </View>

      {(call.summary || call.message) && (
        <Card style={{ gap: 6 }}>
          <Label>{call.summary ? "Summary" : "Message"}</Label>
          <Body>{call.summary || call.message}</Body>
          {call.summary && call.message && <><Label>Message</Label><Body>{call.message}</Body></>}
        </Card>
      )}

      <View style={{ gap: 10 }}>
        {number && <Button title={`Call back ${phone(number)}`} icon={<PhoneCall size={18} color={c.primaryText} />} onPress={() => Linking.openURL(`tel:${number}`)} />}
        {canRules && call.from_number && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Button title={listed?.kind === "vip" ? "VIP" : "Make VIP"} variant="outline" disabled={listed?.kind === "vip"} icon={<Star size={16} color={c.text} />} onPress={() => addTo("vip")} /></View>
            <View style={{ flex: 1 }}><Button title={listed?.kind === "block" ? "Blocked" : "Block"} variant="outline" disabled={listed?.kind === "block"} icon={<Ban size={16} color={c.text} />} onPress={() => addTo("block")} /></View>
          </View>
        )}
        {notice && <Body muted>{notice}</Body>}
        <ErrorText>{error}</ErrorText>
      </View>

      {call.transcript.length > 0 && (
        <View style={{ gap: 8 }}>
          <Label>Transcript</Label>
          {call.transcript.map((t, i) => (
            <View key={i} style={{ alignSelf: t.role === "caller" ? "flex-end" : "flex-start", maxWidth: "88%", borderRadius: 12, padding: 10, backgroundColor: t.role === "caller" ? c.caller : c.muted }}>
              <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>{t.text}</Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
