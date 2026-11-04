// Mobile app waitlist choices and consent wording, shared by the form and
// the server action (which stores the exact wording each person agreed to).

export const PLATFORMS = [
  { id: "ios", label: "iPhone" },
  { id: "android", label: "Android" },
] as const;
export type Platform = (typeof PLATFORMS)[number]["id"];

export const PRODUCTS = [
  { id: "echo", label: "Echo", detail: "Record calls and meetings: transcripts, summaries, action items" },
  { id: "redial", label: "Redial", detail: "AI call screening: your assistant answers, screens and takes messages" },
] as const;

export const USE_CASES = ["Meetings and calls", "Sales calls", "Interviews and research", "Call screening", "Customer support", "Personal use", "Other"];
export const TEAM_SIZES = ["1", "2-10", "11-50", "51-200", "200+"];

export const CONSENT = {
  email: "You'll get email updates about the Echo apps. Every email has an unsubscribe link.",
  sms: "Text me updates about the Echo apps. Up to 4 messages a month. Msg & data rates may apply. Reply STOP to stop, HELP for help.",
  call: "Call me about the Echo apps, by a person or Echo's AI assistant.",
};
