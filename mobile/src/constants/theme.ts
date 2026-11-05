// Redial's colors: the same neutral black-and-white look as the website, with
// green for "you" on a call and red for recording.

export const Colors = {
  light: {
    background: "#FFFFFF", card: "#FFFFFF", muted: "#F4F4F5", border: "#E4E4E7",
    text: "#0A0A0A", textSecondary: "#71717A",
    primary: "#0A0A0A", primaryText: "#FFFFFF",
    you: "#D1FAE5", youText: "#065F46", caller: "#E4E4E7", live: "#DC2626", danger: "#DC2626",
  },
  dark: {
    background: "#0A0A0A", card: "#18181B", muted: "#27272A", border: "#3F3F46",
    text: "#FAFAFA", textSecondary: "#A1A1AA",
    primary: "#FAFAFA", primaryText: "#0A0A0A",
    you: "#064E3B", youText: "#A7F3D0", caller: "#3F3F46", live: "#F87171", danger: "#F87171",
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

export const Spacing = { one: 4, two: 8, three: 12, four: 16, five: 24, six: 32 } as const;
export const Radius = { small: 8, medium: 12, large: 16, pill: 999 } as const;
