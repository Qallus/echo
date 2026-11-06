// Directory: transfer the caller to a saved destination, or (with
// permission) a one-time number after confirming it. The status is what
// actually happened: calling, connected, or that it didn't go through.
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { PhoneForwarded } from "lucide-react-native";
import { FEATURES } from "@shared/features";
import { normalizeNumber } from "@shared/types";
import { Button, ErrorText } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { post } from "@/lib/api";
import { phone } from "@/lib/format";
import type { DirectoryEntry, LiveTransfer } from "@/lib/types";
import { s } from "./styles";

type To = { destinationId: string } | { number: string; confirmed: true };

export function Directory({ callId, assistant, directory, canCustom, transfers }: {
  callId: string; assistant: string; directory: DirectoryEntry[]; canCustom: boolean; transfers: LiveTransfer[];
}) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const latest = transfers.at(-1);
  const busy = latest && ["ringing", "accepted", "connected"].includes(latest.status);

  const send = async (to: To) => {
    setError(null); setPending(true);
    try { await post("live.transfer", { callId, to }); setOpen(false); setNumber(""); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setPending(false); }
  };

  const custom = () => {
    const n = normalizeNumber(number);
    if (!n) { setError("Enter a valid phone number."); return; }
    Alert.alert("Transfer the caller?", `${phone(n)} isn't in your directory.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Transfer", onPress: () => send({ number: n, confirmed: true }) },
    ]);
  };

  return (
    <View style={{ gap: 8 }}>
      {latest && <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={[s.small, { color: c.text }]}>{statusText(latest, assistant)}</Text>}
      {!busy && (open ? (
        <View style={[s.section, { borderColor: c.border }]}>
          <Text style={[s.heading, { color: c.text }]}>Transfer the caller to</Text>
          {directory.length ? (
            <View style={s.people}>
              {directory.map((d) => (
                <Pressable key={d.id} accessibilityRole="button" accessibilityHint={phone(d.number) ?? undefined} disabled={pending} onPress={() => send({ destinationId: d.id })}
                  style={[s.chip, { borderColor: c.border, opacity: pending ? 0.5 : 1 }]}>
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : <Text style={[s.small, { color: c.textSecondary }]}>No saved destinations. Add them under Directory on the website.</Text>}
          {canCustom && (
            <View style={s.row}>
              <TextInput value={number} onChangeText={setNumber} keyboardType="phone-pad" placeholder="Or a one-time number" placeholderTextColor={c.textSecondary}
                accessibilityLabel="One-time number" style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }]} />
              <Pressable accessibilityRole="button" disabled={pending || !number} onPress={custom}
                style={[s.chip, { borderColor: c.border, opacity: pending || !number ? 0.4 : 1 }]}>
                <Text style={{ color: c.text, fontWeight: "600" }}>Transfer</Text>
              </Pressable>
            </View>
          )}
          <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
        </View>
      ) : (
        <Button title={FEATURES.directory.action} variant="outline" icon={<PhoneForwarded size={16} color={c.text} />} onPress={() => setOpen(true)} />
      ))}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function statusText(t: LiveTransfer, assistant: string) {
  switch (t.status) {
    case "ringing": return `Calling ${t.label}… they'll hear who's calling and press 1 to take it.`;
    case "accepted": return `${t.label} accepted. Connecting…`;
    case "connected": return `Connected to ${t.label}. ${assistant} has left the call.`;
    case "ended": return `${t.label} took the call.`;
    case "no_answer": return `${t.label} didn't answer. The caller is still on the line.`;
    case "declined": return `${t.label} didn't take the call. The caller is still on the line.`;
    default: return `The transfer to ${t.label} didn't go through. The caller is still on the line.`;
  }
}
