// Push notifications: permission, Android channels, and registering this
// phone with Echo (devices.register), which then sends calls and other
// notifications here. Needs a development build with FCM set up.
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { post } from "./api";

export type PushResult = { ok: true } | { ok: false; reason: "denied" | "unsupported" | "error"; message?: string };

const projectId = () => Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

// Calls get their own channel, so people can give them a different sound.
async function channels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("calls", { name: "Calls", importance: AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250] });
  await Notifications.setNotificationChannelAsync("default", { name: "Other notifications", importance: AndroidImportance.DEFAULT });
}

export async function pushPermission() {
  if (Platform.OS === "web") return "unsupported" as const;
  return (await Notifications.getPermissionsAsync()).status;
}

export async function registerForPush(ask: boolean): Promise<PushResult> {
  if (Platform.OS === "web") return { ok: false, reason: "unsupported" };
  try {
    await channels();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return { ok: false, reason: "denied" };
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    await post("devices.register", { token, platform: Platform.OS, appVersion: Constants.expoConfig?.version });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function unregisterPush() {
  if (Platform.OS === "web") return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    await post("devices.unregister", { token });
  } catch { /* signing out anyway; the server drops tokens that stop working */ }
}

// Notifications carry a web path (/calls?call=<id>); this maps it to a screen.
export function routeFor(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const call = url.match(/^\/calls\?call=([0-9a-f-]{36})/)?.[1];
  if (call) return `/call/${call}`;
  const rec = url.match(/^\/recordings\/([0-9a-f-]{36})/)?.[1];
  if (rec) return `/recording/${rec}`;
  return url.startsWith("/calls") ? "/" : null;
}
