import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { Bell } from "lucide-react-native";
import { Body, Button, Card, ErrorText, Screen, Steps, Title } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { registerForPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { useSetup } from "@/lib/setup";

// Onboarding 6: why notifications matter, then the system prompt. The
// microphone is asked for later, the first time someone listens in.
export default function NotificationsStep() {
  const c = useTheme();
  const { line } = useSetup();
  const { finishSetup } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps = line ? 5 : 2;
  const next = () => {
    if (line) return router.push("/setup/try-it");
    finishSetup(); // no number of their own yet: straight to the app, then the tour
    setTimeout(() => router.push("/tour"), 0);
  };

  const turnOn = async () => {
    setBusy(true);
    const r = await registerForPush(true);
    setBusy(false);
    if (r.ok || r.reason === "unsupported") return next();
    setError(r.reason === "denied"
      ? "Notifications are off for Redial. You can turn them on later in your phone's settings."
      : `Couldn't set up notifications: ${r.message}`);
  };

  return (
    <Screen>
      <Steps at={line ? 4 : 2} of={steps} />
      <Title>Know when your assistant is screening</Title>
      <Body muted>A quiet alert when a call comes in, so you can listen in or take over. Messages and summaries arrive the same way.</Body>
      <Card style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Bell size={20} color={c.text} />
        <View style={{ flex: 1, gap: 2 }}>
          <Body style={{ fontWeight: "600" }}>Call from Mike (Strategic Income Group)</Body>
          <Body muted>Wants to talk about a quote. Asked for a callback before 5pm.</Body>
        </View>
      </Card>
      <Body muted>You choose what shows on the lock screen in Settings.</Body>
      <ErrorText>{error}</ErrorText>
      <View style={{ flex: 1 }} />
      <Button title="Turn on notifications" onPress={turnOn} busy={busy} />
      <Button title={error ? "Continue" : "Not now"} variant="ghost" onPress={next} />
    </Screen>
  );
}
