import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Linking, View } from "react-native";
import { CircleCheck, PhoneCall } from "lucide-react-native";
import { Body, Button, Card, Screen, Steps, Title } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { get } from "@/lib/api";
import { phone } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useSetup } from "@/lib/setup";
import type { LineData } from "@/lib/types";

// Onboarding 7: call your Redial number and watch the call arrive.
export default function TryItStep() {
  const c = useTheme();
  const { line } = useSetup();
  const { finishSetup } = useSession();
  const since = useRef(new Date().toISOString());
  const [arrived, setArrived] = useState<string | null>(null);

  // Check for a new call every few seconds while this screen is open.
  useEffect(() => {
    if (!line || arrived) return;
    const id = setInterval(async () => {
      const d = await get<LineData>("line", { line: line.id }).catch(() => null);
      const call = d?.calls.find((x) => x.started_at > since.current);
      if (call) setArrived(call.status === "screening" || call.status === "ringing" ? "Your assistant is answering it now." : "Your assistant took the call.");
    }, 4000);
    return () => clearInterval(id);
  }, [line, arrived]);

  // Setup closes (the app's tabs take over), then the tour opens on top.
  const done = () => { finishSetup(); setTimeout(() => router.push("/tour"), 0); };

  return (
    <Screen>
      <Steps at={5} of={5} />
      <Title>Try it: call your Redial number</Title>
      <Body muted>Call from any phone and talk to your assistant. This screen updates when the call arrives.</Body>
      {line && <Button title={`Call ${phone(line.number)}`} variant="outline" icon={<PhoneCall size={18} color={c.text} />} onPress={() => Linking.openURL(`tel:${line.number}`)} />}
      <Card style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        {arrived ? <CircleCheck size={22} color={c.youText} /> : <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.textSecondary, margin: 6 }} />}
        <Body style={{ flex: 1 }}>{arrived ?? "Waiting for your call…"}</Body>
      </Card>
      <View style={{ flex: 1 }} />
      <Button title={arrived ? "Finish" : "Skip for now"} variant={arrived ? "primary" : "ghost"} onPress={done} />
    </Screen>
  );
}
