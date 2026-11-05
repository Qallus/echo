import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { VOICES } from "@shared/types";
import { Body, Button, Choice, ErrorText, Field, Label, Screen, Steps, Title } from "@/components/ui";
import { useSetup } from "@/lib/setup";

// Onboarding 5: the assistant's name, voice and greeting. How it introduces
// itself is entirely up to the member.
export default function AssistantStep() {
  const { me, line, save } = useSetup();
  const first = me?.profile?.full_name?.split(" ")[0] || "me";
  const [name, setName] = useState(line?.assistant_name ?? "");
  const [voice, setVoice] = useState(line?.voice ?? "ara");
  const [greeting, setGreeting] = useState(line?.greeting ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fallback = `Hi, this is ${name.trim() || "your assistant"}, ${first}'s assistant. ${first} can't pick up right now. May I ask who's calling and what it's about?`;

  const next = async () => {
    if (!name.trim()) return setError("Give your assistant a name.");
    setBusy(true);
    const err = await save({ assistant_name: name.trim(), voice, greeting: greeting.trim() });
    setBusy(false);
    if (err) setError(err); else router.push("/setup/notifications");
  };

  return (
    <Screen>
      <Steps at={3} of={5} />
      <Title>Meet your assistant</Title>
      <Body muted>Choose how it sounds and what it says when it answers.</Body>
      <Field label="Name" value={name} onChangeText={setName} maxLength={40} />
      <Label>Voice</Label>
      <View style={{ gap: 8 }}>
        {VOICES.map((v) => <Choice key={v.id} title={v.label} detail={v.detail} selected={voice === v.id} onPress={() => setVoice(v.id)} />)}
      </View>
      <Field label="Greeting (leave empty for the default)" value={greeting} onChangeText={setGreeting} placeholder={fallback} multiline maxLength={500} />
      <ErrorText>{error}</ErrorText>
      <Button title="Continue" onPress={next} busy={busy} />
    </Screen>
  );
}
