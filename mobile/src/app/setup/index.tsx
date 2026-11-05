import { useState } from "react";
import { router } from "expo-router";
import { Linking, Pressable, Text, View } from "react-native";
import { Body, Button, Card, Choice, ErrorText, Label, Loading, Screen, Steps, Title, styles } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { phone } from "@/lib/format";
import { useSetup } from "@/lib/setup";

// Forward only the calls you don't answer, so your cell still rings first.
// Codes can differ by plan; the screen says so.
const CARRIERS = [
  { id: "verizon", label: "Verizon", on: (n: string) => `*71${n}`, off: "*73" },
  { id: "att", label: "AT&T", on: (n: string) => `**004*1${n}#`, off: "##004#" },
  { id: "tmobile", label: "T-Mobile", on: (n: string) => `**004*1${n}#`, off: "##004#" },
  { id: "other", label: "Another carrier", on: null, off: null },
] as const;

// Onboarding 3: your Redial number, and how calls reach it.
export default function NumberStep() {
  const c = useTheme();
  const { me, line, error, reload } = useSetup();
  const [carrier, setCarrier] = useState<(typeof CARRIERS)[number]["id"] | null>(null);
  if (!me && !error) return <Loading />;
  const steps = line ? 5 : 2;
  const digits = line?.number.replace(/^\+1/, "") ?? "";
  const pick = CARRIERS.find((x) => x.id === carrier);

  return (
    <Screen>
      <Steps at={1} of={steps} />
      <Title>Your Redial number</Title>
      <ErrorText>{error}</ErrorText>
      {error && <Button title="Try again" variant="outline" onPress={reload} />}
      {line ? (
        <>
          <Card style={{ alignItems: "center", gap: 4 }}>
            <Label>Calls to this number reach your assistant</Label>
            <Text selectable style={{ color: c.text, fontSize: 30, fontWeight: "700" }}>{phone(line.number)}</Text>
          </Card>
          <Body>Calls reach Redial two ways. Use either or both:</Body>
          <Body>1. Give out your Redial number.</Body>
          <Body>2. Forward the calls you don&apos;t answer on your cell. Your phone rings first; if you don&apos;t pick up, your assistant does.</Body>
          <Label>Your carrier</Label>
          <View style={{ gap: 8 }}>
            {CARRIERS.map((x) => <Choice key={x.id} title={x.label} selected={carrier === x.id} onPress={() => setCarrier(x.id)} />)}
          </View>
          {pick && (
            <Card style={{ gap: 8 }}>
              {pick.on ? (
                <>
                  <Body>On your cell, dial this code and press Call:</Body>
                  <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`tel:${encodeURIComponent(pick.on(digits))}`)}>
                    <Text selectable style={{ color: c.text, fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{pick.on(digits)}</Text>
                  </Pressable>
                  <Body muted>To turn it off later, dial {pick.off}. Codes can differ by plan; your carrier can confirm.</Body>
                </>
              ) : (
                <Body>Look up &ldquo;conditional call forwarding&rdquo; or &ldquo;forward unanswered calls&rdquo; in your carrier&apos;s help, and forward to {phone(line.number)}.</Body>
              )}
            </Card>
          )}
        </>
      ) : me && (
        <Card style={{ gap: 6 }}>
          <Text style={[styles.choiceTitle, { color: c.text }]}>We&apos;re setting up your number</Text>
          <Body muted>Your Redial number appears here as soon as it&apos;s ready, and we&apos;ll let you know. {me.lines.length ? "Lines others shared with you are in the Calls tab." : ""}</Body>
        </Card>
      )}
      <View style={{ flex: 1 }} />
      <Button title="Continue" onPress={() => router.push(line ? "/setup/screening" : "/setup/notifications")} disabled={!me} />
    </Screen>
  );
}
