// Mirror on the live card: on/off, then suggestions as they come (newest
// first) with where each came from, and drafted texts or emails that only
// go out after the person reviews them and presses Send.
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { BookOpen, History, Info, Mail, MessageCircleReply, MessageSquare, Phone, Sparkles, TriangleAlert, X } from "lucide-react-native";
import { FEATURES } from "@shared/features";
import { Button, ErrorText } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { post } from "@/lib/api";
import type { LiveSuggestion } from "@/lib/types";
import { s } from "./styles";

const KIND = {
  say: { icon: MessageCircleReply, label: "Say" }, answer: { icon: Sparkles, label: "Answer" }, info: { icon: Info, label: "Info" },
  caution: { icon: TriangleAlert, label: "Careful" }, sms: { icon: MessageSquare, label: "Text" }, email: { icon: Mail, label: "Email" },
} as const;
const SOURCE: Record<string, { icon: typeof Info; label: string }> = {
  call: { icon: Phone, label: "This call" }, knowledge: { icon: BookOpen, label: "Your notes" },
  history: { icon: History, label: "Earlier call" }, directory: { icon: Phone, label: "Directory" },
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Mirror({ callId, callerNumber, mirror, suggestions }: {
  callId: string; callerNumber: string | null; mirror: { state: string; error: string | null } | null; suggestions: LiveSuggestion[];
}) {
  const c = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const on = mirror?.state === "starting" || mirror?.state === "running";
  const shown = suggestions.filter((x) => x.status !== "dismissed");

  const toggle = async () => {
    setError(null); setPending(true);
    try { await post(on ? "mirror.stop" : "mirror.start", { callId }); } catch (e) { setError(message(e)); } finally { setPending(false); }
  };

  return (
    <View style={[s.section, { borderColor: c.border }]} accessibilityLabel={FEATURES.mirror.name}>
      <View style={s.row}>
        <Sparkles size={15} color={c.text} />
        <View style={{ flex: 1 }}>
          <Text style={[s.heading, { color: c.text }]}>{FEATURES.mirror.name}</Text>
          <Text style={[s.small, { color: c.textSecondary }]}>
            {mirror?.state === "running" ? "Listening silently. The caller can't hear it." : mirror?.state === "starting" ? "Starting…"
              : mirror?.state === "failed" ? "Couldn't listen to this call." : "Off for this call."}
          </Text>
        </View>
        <Pressable accessibilityRole="button" disabled={pending} onPress={toggle} style={[s.chip, { borderColor: c.border, opacity: pending ? 0.5 : 1 }]}>
          <Text style={{ color: c.text, fontWeight: "600" }}>{on ? "Stop" : `Start ${FEATURES.mirror.name}`}</Text>
        </Pressable>
      </View>
      <ErrorText>{error}</ErrorText>
      {on && shown.length === 0 && <Text style={[s.small, { color: c.textSecondary }]}>Suggestions appear here as the conversation goes.</Text>}
      {shown.map((x) => (x.kind === "sms" || x.kind === "email" ? <Draft key={x.id} s={x} callerNumber={callerNumber} /> : <Tip key={x.id} s={x} />))}
    </View>
  );
}

function Dismiss({ id }: { id: string }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} onPress={() => post("mirror.dismiss", { id }).catch(() => {})}>
      <X size={16} color={c.textSecondary} />
    </Pressable>
  );
}

function Tip({ s: x }: { s: LiveSuggestion }) {
  const c = useTheme();
  const K = KIND[x.kind];
  const src = x.source ? SOURCE[x.source] : null;
  return (
    <View style={[s.section, { borderColor: x.kind === "caution" ? c.live : c.border }]}>
      <View style={[s.row, { alignItems: "flex-start" }]}>
        <K.icon size={15} color={c.textSecondary} accessibilityLabel={K.label} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>{x.title}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 20 }}>{x.body}</Text>
          {src && <View style={[s.row, { gap: 4 }]}><src.icon size={11} color={c.textSecondary} /><Text style={{ color: c.textSecondary, fontSize: 11 }}>{src.label}</Text></View>}
        </View>
        <Dismiss id={x.id} />
      </View>
    </View>
  );
}

// A drafted text or email: editable, and sent only when the person presses Send.
function Draft({ s: x, callerNumber }: { s: LiveSuggestion; callerNumber: string | null }) {
  const c = useTheme();
  const sms = x.kind === "sms";
  const [to, setTo] = useState(x.sent_to ?? (sms ? callerNumber ?? "" : ""));
  const [subject, setSubject] = useState(x.subject ?? "");
  const [body, setBody] = useState(x.body);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [pending, setPending] = useState(false);
  const K = KIND[x.kind];
  const input = [s.input, { flex: 0, color: c.text, borderColor: c.border, backgroundColor: c.background }];

  if (x.status === "sent") return <Text style={[s.small, { color: c.textSecondary }]}>{sms ? "Text" : "Email"} sent to {x.sent_to}: {x.title}</Text>;
  const send = async () => {
    setPending(true);
    try { setResult(await post<{ ok?: string }>("mirror.send", { id: x.id, draft: { to, subject, body } })); } catch (e) { setResult({ error: message(e) }); } finally { setPending(false); }
  };

  return (
    <View style={[s.section, { borderColor: c.primary }]}>
      <View style={[s.row, { alignItems: "flex-start" }]}>
        <K.icon size={15} color={c.text} />
        <Text style={{ flex: 1, color: c.text, fontSize: 14, fontWeight: "600" }}>{x.title} <Text style={{ fontWeight: "400", color: c.textSecondary }}>· review before sending</Text></Text>
        <Dismiss id={x.id} />
      </View>
      <TextInput value={to} onChangeText={setTo} keyboardType={sms ? "phone-pad" : "email-address"} autoCapitalize="none" accessibilityLabel="To"
        placeholder={sms ? "Their mobile number" : "Their email address"} placeholderTextColor={c.textSecondary} style={input} />
      {!sms && <TextInput value={subject} onChangeText={setSubject} maxLength={200} accessibilityLabel="Subject" placeholder="Subject" placeholderTextColor={c.textSecondary} style={input} />}
      <TextInput value={body} onChangeText={setBody} multiline maxLength={1600} accessibilityLabel="Message"
        style={[...input, { minHeight: sms ? 72 : 120, paddingTop: 10, textAlignVertical: "top" }]} />
      <Button title={pending ? "Sending…" : `Send ${sms ? "text" : "email"}`} busy={pending} disabled={!to.trim() || !body.trim()} onPress={send} />
      {x.status === "failed" && !result.ok && <ErrorText>The last try didn&apos;t send.</ErrorText>}
      {result.ok && <Text style={[s.small, { color: c.textSecondary }]}>{result.ok}</Text>}
      <ErrorText>{result.error}</ErrorText>
    </View>
  );
}
