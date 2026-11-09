// Phone carriers and their call forwarding codes, for the setup wizard on the
// web and the mobile app (imported there as @shared/carriers, so no imports).
// Codes follow the carrier's network: GSM networks (AT&T, T-Mobile and the
// brands that use them) share the standard codes; Verizon and the brands on
// its network use the * codes. Plans differ, so the wizard always says the
// carrier can confirm.

export type Network = "gsm" | "verizon";
export type Carrier = { id: string; label: string; network: Network | null; note?: string };

export const CARRIERS: Carrier[] = [
  { id: "tmobile", label: "T-Mobile", network: "gsm" },
  { id: "att", label: "AT&T", network: "gsm" },
  { id: "verizon", label: "Verizon", network: "verizon" },
  { id: "mint", label: "Mint Mobile", network: "gsm" },
  { id: "boost", label: "Boost Mobile", network: "gsm" },
  { id: "cricket", label: "Cricket Wireless", network: "gsm" },
  { id: "metro", label: "Metro by T-Mobile", network: "gsm" },
  { id: "visible", label: "Visible", network: "verizon", note: "If the code doesn't work, turn on forwarding in the Visible app." },
  { id: "googlefi", label: "Google Fi Wireless", network: null, note: "Turn on call forwarding in the Google Fi app or at fi.google.com." },
  { id: "usmobile", label: "US Mobile", network: "gsm", note: "On US Mobile's Verizon network, use the Verizon codes instead." },
  { id: "consumer", label: "Consumer Cellular", network: "gsm" },
  { id: "spectrum", label: "Spectrum Mobile", network: "verizon" },
  { id: "xfinity", label: "Xfinity Mobile", network: "verizon" },
  { id: "straighttalk", label: "Straight Talk", network: null, note: "The code depends on which network your phone uses. Straight Talk support can tell you." },
  { id: "tracfone", label: "Tracfone", network: null, note: "The code depends on which network your phone uses. Tracfone support can tell you." },
  { id: "other", label: "Other / not sure", network: null },
];

export const carrier = (id: string | null | undefined) => CARRIERS.find((c) => c.id === id) ?? null;

// "missed": your phone rings first; calls you don't answer, decline or can't
// get (busy, no answer, no signal) go to Redial. "all": every call goes to
// Redial and your phone doesn't ring.
export type ForwardMode = "missed" | "all";
export const FORWARDING: Record<Network, Record<ForwardMode, { on: (n: string) => string; off: string }>> = {
  gsm: {
    missed: { on: (n) => `**004*1${n}#`, off: "##004#" },
    all: { on: (n) => `**21*1${n}#`, off: "##21#" },
  },
  verizon: {
    missed: { on: (n) => `*71${n}`, off: "*73" },
    all: { on: (n) => `*72${n}`, off: "*73" },
  },
};

// The code to dial for a carrier and Redial number (10 digits), or null when
// the carrier sets forwarding another way.
export function forwardingCode(carrierId: string | null | undefined, mode: ForwardMode, redialNumber?: string | null) {
  const net = carrier(carrierId)?.network;
  if (!net) return null;
  const digits = (redialNumber ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const f = FORWARDING[net][mode];
  return { on: f.on(digits || "<your Redial number>"), off: f.off, ready: digits.length === 10 };
}
