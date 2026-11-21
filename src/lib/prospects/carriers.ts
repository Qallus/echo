// Who carries a business number, from Twilio Lookup's carrier_name and line
// type. Edit the patterns here (no other code needs to change). Carrier names
// drift over time: anything that doesn't match lands in "unknown" and shows
// under Unmapped carriers on Admin -> Prospects, so add it here.
// Spec: docs/Prospecting/06-PROSPECT-CARRIER-LOOKUP.md section 3.

export type Provider = "ringcentral" | "cox" | "spectrum" | "lumen" | "mobile" | "other_voip" | "landline" | "unknown";
export type Confidence = "confirmed" | "possible" | "unknown";

export const PROVIDERS: Record<Provider, { label: string; tone: string }> = {
  ringcentral: { label: "RingCentral", tone: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  cox: { label: "Cox Business", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  spectrum: { label: "Spectrum Business", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  lumen: { label: "Lumen / CenturyLink", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  mobile: { label: "Mobile", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  other_voip: { label: "Other VoIP", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  landline: { label: "Other landline", tone: "bg-secondary text-secondary-foreground" },
  unknown: { label: "Unknown", tone: "bg-muted text-muted-foreground" },
};

// Checked in order; the first match wins.
const RULES: { provider: Provider; pattern: RegExp }[] = [
  { provider: "ringcentral", pattern: /ringcentral/i },
  { provider: "cox", pattern: /\bcox(com)?\b/i },
  { provider: "spectrum", pattern: /charter|spectrum|time warner|bright house/i },
  { provider: "lumen", pattern: /lumen|centurylink|qwest/i },
  { provider: "mobile", pattern: /t-mobile|verizon wireless|cellco|at&t (mobility|wireless)|new cingular|cingular|sprint|us cellular|u\.s\. cellular|mint mobile|google fi|metropcs|cricket|visible/i },
  { provider: "other_voip", pattern: /nextiva|vonage|8x8|dialpad|ooma|zoom|google|onvoy|inteliquent|peerless|level 3|twilio|telnyx|intrado|bandwidth|grasshopper|line2|textnow|magicjack/i },
];

const VOIP = new Set(["fixedVoip", "nonFixedVoip", "voip"]);

export function mapCarrier(carrierName: string | null, lineType: string | null): { provider: Provider; confidence: Confidence } {
  const name = carrierName ?? "";
  // Bandwidth carries many cloud phone systems (RingCentral among them), so
  // on a VoIP line it's only a "possible" RingCentral.
  if (/bandwidth/i.test(name) && lineType && VOIP.has(lineType)) return { provider: "ringcentral", confidence: "possible" };
  const rule = RULES.find((r) => r.pattern.test(name));
  if (rule) return { provider: rule.provider, confidence: "confirmed" };
  // No carrier match: fall back to the line type.
  if (lineType === "mobile") return { provider: "mobile", confidence: "confirmed" };
  if (lineType && VOIP.has(lineType)) return { provider: "other_voip", confidence: "possible" };
  if (lineType === "landline") return { provider: "landline", confidence: "possible" };
  return { provider: "unknown", confidence: "unknown" };
}

// What to say on the first call, by provider (shown on the prospect and lead).
export const TALK_TRACKS: Partial<Record<Provider, string>> = {
  ringcentral: "AI receptionist included with more minutes, texting and booking built in, a free number port and the phone menu rebuilt for you.",
  cox: "Keep your number and your Cox line. Add an AI receptionist on top with call forwarding, live today. No porting needed.",
  spectrum: "Keep your number and your Spectrum line. Add an AI receptionist on top with call forwarding, live today. No porting needed.",
  mobile: "You're answering customers on your cell. Your assistant answers first and texts you the summary.",
  lumen: "Replace the old landline, keep the number, and add an AI receptionist.",
  landline: "Replace the old landline, keep the number, and add an AI receptionist.",
  other_voip: "Everything your phone system does, plus an AI receptionist that answers, books and texts.",
};
