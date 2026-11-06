// Shared by the live call card and its controls.
import { StyleSheet } from "react-native";
import { Radius, Spacing } from "@/constants/theme";

export const s = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.three },
  section: { borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, fontSize: 16, fontWeight: "700" },
  heading: { fontSize: 13, fontWeight: "600" },
  small: { fontSize: 13, lineHeight: 18 },
  people: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  person: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3, fontSize: 12 },
  bubble: { flexDirection: "row", gap: 6, maxWidth: "88%", borderRadius: Radius.medium, paddingHorizontal: 10, paddingVertical: 8 },
  who: { fontSize: 11, fontWeight: "600" },
  chip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: Radius.medium, alignItems: "center", justifyContent: "center" },
});
