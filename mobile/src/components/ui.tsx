// The app's building blocks, styled like the website: plain, high-contrast,
// rounded. Text always uses the theme's text colors.
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Screen({ children, scroll = true, style, edges = ["top", "bottom"] }: {
  children: React.ReactNode; scroll?: boolean; style?: ViewStyle; edges?: ("top" | "bottom")[];
}) {
  const c = useTheme();
  const body = <View style={[styles.screen, style]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={edges}>
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  return <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: object }) {
  const c = useTheme();
  return <Text style={[styles.body, { color: muted ? c.textSecondary : c.text }, style]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  return <Text style={[styles.label, { color: c.textSecondary }]}>{children}</Text>;
}

export function Button({ title, onPress, variant = "primary", disabled, busy, icon }: {
  title: string; onPress?: () => void; variant?: "primary" | "outline" | "ghost"; disabled?: boolean; busy?: boolean; icon?: React.ReactNode;
}) {
  const c = useTheme();
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} onPress={onPress} disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: c.primary } : variant === "outline" ? { borderWidth: 1, borderColor: c.border } : null,
        { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}>
      {busy ? <ActivityIndicator color={primary ? c.primaryText : c.text} /> : (
        <View style={styles.row}>{icon}<Text style={[styles.buttonText, { color: primary ? c.primaryText : c.text }]}>{title}</Text></View>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={c.textSecondary} accessibilityLabel={label} {...props}
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }, props.multiline && { minHeight: 96, paddingTop: 12, textAlignVertical: "top" }]}
      />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useTheme();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>;
}

// One option in a single-choice list.
export function Choice({ title, detail, selected, onPress }: { title: string; detail?: string; selected: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress}
      style={[styles.card, { borderColor: selected ? c.primary : c.border, borderWidth: selected ? 2 : 1, backgroundColor: c.card }]}>
      <View style={styles.row}>
        <View style={[styles.radio, { borderColor: selected ? c.primary : c.border }]}>{selected && <View style={[styles.dot, { backgroundColor: c.primary }]} />}</View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.choiceTitle, { color: c.text }]}>{title}</Text>
          {detail && <Text style={[styles.small, { color: c.textSecondary }]}>{detail}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  const c = useTheme();
  return children ? <Text accessibilityRole="alert" style={[styles.small, { color: c.danger }]}>{children}</Text> : null;
}

export function Loading() {
  const c = useTheme();
  return <View style={[styles.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.text} /></View>;
}

// Step N of M, for setup.
export function Steps({ at, of }: { at: number; of: number }) {
  const c = useTheme();
  return (
    <View accessibilityLabel={`Step ${at} of ${of}`} style={[styles.row, { gap: 6 }]}>
      {Array.from({ length: of }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < at ? c.primary : c.muted }} />
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, padding: Spacing.five, gap: Spacing.four },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  body: { fontSize: 16, lineHeight: 23 },
  label: { fontSize: 13, fontWeight: "600" },
  small: { fontSize: 13, lineHeight: 18 },
  button: { minHeight: 50, borderRadius: Radius.medium, paddingHorizontal: Spacing.four, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, fontSize: 16 },
  card: { borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  choiceTitle: { fontSize: 16, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
