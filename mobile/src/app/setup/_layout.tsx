import { Stack } from "expo-router";
import { SetupProvider } from "@/lib/setup";

// Onboarding after sign-in: number, screening, assistant, notifications, a
// test call. Each step can be skipped; everything can be changed in Settings.
export default function SetupLayout() {
  return (
    <SetupProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SetupProvider>
  );
}
