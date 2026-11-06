// Audible: private directions to the assistant while it's on the call. The
// caller never hears them. Status is what the gateway reported: waiting for
// a pause, delivered (the assistant has it, which isn't the same as
// following it), or not delivered.
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Check, Clock, MessageSquareLock, SendHorizontal, X } from "lucide-react-native";
import { FEATURES } from "@shared/features";
import { ErrorText } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { post } from "@/lib/api";
import type { LiveDirection } from "@/lib/types";
import { s } from "./styles";

const SUGGESTIONS = [
  "Ask which project they're calling about.",
  "Get their email address.",
  "Tell them I'll call back today.",
  "Wrap up the call politely.",
];

export function Audible({ callId, assistant, directions }: { callId: string; assistant: string; directions: LiveDirection[] }) {
  const c = useTheme();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const send = async (value: string) => {
    const v = value.trim();
    if (!v || pending) return;
    setError(null); setPending(true);
    try { await post("live.direct", { callId, text: v }); setText(""); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setPending(false); }
  };

  return (
    <View style={[s.section, { borderColor: c.border }]} accessibilityLabel={`${FEATURES.audible.name}: private directions`}>
      <View style={s.row}>
        <MessageSquareLock size={15} color={c.text} />
        <Text style={[s.heading, { color: c.text, flex: 1 }]}>Guide {assistant} privately <Text style={{ fontWeight: "400", color: c.textSecondary }}>· the caller can&apos;t hear this</Text></Text>
      </View>
      {directions.map((d) => (
        <View key={d.id} style={[s.row, { alignItems: "flex-start" }]}>
          <Text style={{ flex: 1, color: c.text, fontSize: 14, lineHeight: 20 }}>{d.text}{!d.mine && <Text style={{ color: c.textSecondary }}> · from a team member</Text>}</Text>
          <Status status={d.status} assistant={assistant} />
        </View>
      ))}
      <View style={s.row}>
        <TextInput value={text} onChangeText={setText} editable={!pending} maxLength={500} placeholder="e.g. Ask when they need it done"
          placeholderTextColor={c.textSecondary} accessibilityLabel={`Private direction for ${assistant}`} returnKeyType="send"
          onSubmitEditing={() => send(text)} style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Send to the assistant" disabled={pending || !text.trim()} onPress={() => send(text)}
          style={[s.send, { backgroundColor: c.primary, opacity: pending || !text.trim() ? 0.4 : 1 }]}>
          <SendHorizontal size={18} color={c.primaryText} />
        </Pressable>
      </View>
      <View style={s.people}>
        {SUGGESTIONS.map((x) => (
          <Pressable key={x} accessibilityRole="button" disabled={pending} onPress={() => send(x)} style={[s.chip, { borderColor: c.border, opacity: pending ? 0.5 : 1 }]}>
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>{x}</Text>
          </Pressable>
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function Status({ status, assistant }: { status: LiveDirection["status"]; assistant: string }) {
  const c = useTheme();
  const [Icon, label, color] = status === "delivered" ? [Check, `Delivered to ${assistant}`, c.youText]
    : status === "failed" ? [X, "Not delivered", c.danger] : [Clock, "Waiting for a pause", c.textSecondary];
  return <View style={[s.row, { gap: 3 }]}><Icon size={12} color={color} /><Text style={{ color, fontSize: 11 }}>{label}</Text></View>;
}
