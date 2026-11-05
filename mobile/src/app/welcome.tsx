import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { DemoCall } from "@/components/demo-call";
import { Body, Button, Screen, Title } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";

// Onboarding 1: what Redial is, shown as a short call.
export default function Welcome() {
  const c = useTheme();
  return (
    <Screen>
      <Text style={[s.brand, { color: c.text }]}>REDIAL</Text>
      <View style={{ gap: 8 }}>
        <Title>Your assistant answers. You take the calls that matter.</Title>
        <Body muted>Redial screens your calls, takes messages and lets you step in live. Echo records and summarizes your conversations, built in.</Body>
      </View>
      <DemoCall />
      <View style={{ flex: 1 }} />
      <View style={{ gap: 10 }}>
        <Button title="Get started" onPress={() => router.push({ pathname: "/sign-in", params: { mode: "create" } })} />
        <Button title="I have an account" variant="outline" onPress={() => router.push("/sign-in")} />
        <Button title="See what Redial can do" variant="ghost" onPress={() => router.push("/tour")} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({ brand: { fontSize: 15, fontWeight: "700", letterSpacing: 4 } });
