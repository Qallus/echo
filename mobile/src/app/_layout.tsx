import { useEffect } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { Platform } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { routeFor } from "@/lib/push";
import { SessionProvider, useSession } from "@/lib/session";

SplashScreen.preventAutoHideAsync();

// Show notifications while the app is open, too.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

// Which screens are reachable: signed out -> welcome and sign-in; signed in
// but not set up on this phone -> setup; otherwise the app. The tour opens
// from anywhere. (The server checks every request anyway.)
function Routes() {
  const { loading, session, setupDone } = useSession();

  useEffect(() => { if (!loading) SplashScreen.hideAsync(); }, [loading]);

  // Tapping a notification opens its call or recording.
  useEffect(() => {
    if (Platform.OS === "web" || !session) return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const to = routeFor(r.notification.request.content.data?.url);
      if (to) router.push(to as never);
    });
    return () => sub.remove();
  }, [session]);

  if (loading) return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session} redirectTo={setupDone ? "/" : "/setup"}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !setupDone} redirectTo={session ? "/" : "/welcome"}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && setupDone} redirectTo={session ? "/setup" : "/welcome"}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="call/[id]" options={{ headerShown: true, title: "Call", headerBackTitle: "Calls" }} />
        <Stack.Screen name="recording/[id]" options={{ headerShown: true, title: "Recording", headerBackTitle: "Echo" }} />
      </Stack.Protected>
      <Stack.Screen name="tour" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <Routes />
      </SessionProvider>
    </ThemeProvider>
  );
}
