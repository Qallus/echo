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

// How often we may text, and which updates they want. Both are theirs to
// change; automations and staff follow them.
export const SMS_FREQUENCIES = [
  { id: "major", label: "Only the big news (launch day, beta invite)" },
  { id: "monthly", label: "About once a month" },
  { id: "weekly", label: "About once a week" },
  { id: "all", label: "Every update" },
] as const;
export const UPDATE_TOPICS = [
  { id: "launch", label: "Launch news" },
  { id: "beta", label: "Early access invites" },
  { id: "features", label: "New features" },
  { id: "tips", label: "Tips and how-tos" },
  { id: "offers", label: "Offers" },
] as const;

export const CONSENT = {
  email: "You'll get email updates about the Echo apps on the topics you pick. Every email has an unsubscribe link.",
  sms: "Text me updates about the Echo apps on the topics I pick, as often as I chose. Message frequency varies. Msg & data rates may apply. Reply STOP to stop, HELP for help.",
  call: "Call me about the Echo apps, by a person or Echo's AI assistant.",
};
