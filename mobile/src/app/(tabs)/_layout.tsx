import { Tabs } from "expo-router";
import { AudioLines, PhoneCall, Settings } from "lucide-react-native";
import { useTheme } from "@/hooks/use-theme";

// Redial's calls come first; Echo is its own tab.
export default function TabsLayout() {
  const c = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: c.text, tabBarInactiveTintColor: c.textSecondary,
      tabBarStyle: { backgroundColor: c.background, borderTopColor: c.border },
    }}>
      <Tabs.Screen name="index" options={{ title: "Calls", tabBarIcon: ({ color, size }) => <PhoneCall color={color} size={size} /> }} />
      <Tabs.Screen name="echo" options={{ title: "Echo", tabBarIcon: ({ color, size }) => <AudioLines color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
    </Tabs>
  );
}
