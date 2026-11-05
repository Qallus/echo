import { useEffect, useState } from "react";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Linking, View } from "react-native";
import { Body, Button, Card, Choice, ErrorText, Label, Screen, Title } from "@/components/ui";
import { get, post } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { pushPermission, registerForPush, unregisterPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { useLoad } from "@/lib/use-load";
import type { Me } from "@/lib/types";

const PRIVACY = [
  { id: "full", title: "Full detail", detail: "Who's calling and why, e.g. “Mike (Strategic Income Group) is calling about a quote.”" },
  { id: "caller", title: "Caller only", detail: "Who's calling, nothing about why." },
  { id: "private", title: "Private", detail: "Just “New call”. Open Redial to see who." },
] as const;

const SUPPORT = "support@redial.si";

export default function SettingsTab() {
  const { session, signOut } = useSession();
  const me = useLoad(() => get<Me>("me"), "me");
  const [privacy, setPrivacy] = useState<string | null>(null);
  const [push, setPush] = useState<string>("undetermined");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { pushPermission().then(setPush); }, []);
  const level = privacy ?? me.data?.profile?.push_privacy ?? "full";

  const choose = async (id: string) => {
    setPrivacy(id); setError(null);
    try { await post("settings.push-privacy", { level: id }); } catch (e) { setPrivacy(null); setError(e instanceof Error ? e.message : String(e)); }
  };
  const turnOn = async () => {
    const r = await registerForPush(true);
    setPush(await pushPermission());
    if (!r.ok && r.reason === "denied") Linking.openSettings();
    else if (!r.ok && r.reason === "error") setError(`Couldn't set up notifications: ${r.message}`);
  };
  const out = async () => { await unregisterPush(); await signOut(); };

  return (
    <Screen edges={["top"]}>
      <Title>Settings</Title>
      <Card style={{ gap: 2 }}>
        <Body style={{ fontWeight: "600" }}>{me.data?.profile?.full_name || "Your account"}</Body>
        <Body muted>{session?.user.email}</Body>
      </Card>

      <View style={{ gap: 8 }}>
        <Label>Notifications</Label>
        {push !== "granted" && push !== "unsupported" && <Button title="Turn on notifications" variant="outline" onPress={turnOn} />}
        <Body muted>On the lock screen, show:</Body>
        {PRIVACY.map((p) => <Choice key={p.id} title={p.title} detail={p.detail} selected={level === p.id} onPress={() => choose(p.id)} />)}
        <ErrorText>{error}</ErrorText>
      </View>

      <View style={{ gap: 8 }}>
        <Label>More</Label>
        <Button title="Feature tour" variant="outline" onPress={() => router.push("/tour")} />
        <Button title="Screening rules and sharing on the web" variant="outline" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/calls`)} />
        <Button title="Help and FAQ" variant="outline" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/faq`)} />
      </View>

      <View style={{ gap: 8 }}>
        <Button title="Sign out" variant="outline" onPress={out} />
        <Button title="Delete my account" variant="ghost" onPress={() => Linking.openURL(`mailto:${SUPPORT}?subject=${encodeURIComponent("Delete my account")}&body=${encodeURIComponent(`Please delete my Redial account (${session?.user.email ?? ""}).`)}`)} />
        <Body muted style={{ fontSize: 13 }}>We delete your account and its content within 30 days.</Body>
      </View>
    </Screen>
  );
}
