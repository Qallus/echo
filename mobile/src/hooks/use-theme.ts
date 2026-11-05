import { Colors, type Theme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useTheme(): Theme {
  return Colors[useColorScheme() === "dark" ? "dark" : "light"];
}
