import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { MODES, type Mode } from "@shared/types";
import { Body, Button, Choice, ErrorText, Screen, Steps, Title } from "@/components/ui";
import { useSetup } from "@/lib/setup";

// Onboarding 4: who gets screened. Spam-only needs a spam-check service,
// which isn't connected, so it isn't offered.
export default function ScreeningStep() {
  const { line, save } = useSetup();
  const [mode, setMode] = useState<Mode>(line?.mode === "spam" ? "unknown" : line?.mode ?? "unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = async () => {
    setBusy(true);
    const err = await save({ mode });
    setBusy(false);
    if (err) setError(err); else router.push("/setup/assistant");
  };

  return (
    <Screen>
      <Steps at={2} of={5} />
      <Title>Who should your assistant answer?</Title>
      <Body muted>VIPs always ring straight through and blocked numbers never do. You can change this any time.</Body>
      <View style={{ gap: 8 }}>
        {MODES.filter((m) => !m.needsSpamCheck).map((m) => (
          <Choice key={m.id} title={m.label} detail={m.detail} selected={mode === m.id} onPress={() => setMode(m.id)} />
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
      <View style={{ flex: 1 }} />
      <Button title="Continue" onPress={next} busy={busy} />
    </Screen>
  );
}
