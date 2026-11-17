// Fraud protection: the verdicts and the signals behind them, shared by the
// server (assistant tools, webhooks, the after-call review) and the screens.

export type Verdict = "legit" | "unverified" | "likely_scam";
export const VERDICT_RANK: Record<Verdict, number> = { legit: 0, unverified: 1, likely_scam: 2 };
export const VERDICT_LABEL: Record<Verdict, string> = { legit: "Looks legit", unverified: "Can't verify", likely_scam: "Likely scam" };

// What the assistant (or the after-call review) can flag during a call.
export const RISK_SIGNALS = {
  claims_family: "Said they're a family member",
  bail_or_jail: "Said someone is in jail or needs bail or a lawyer",
  accident_or_hospital: "Said someone was in an accident or is in the hospital",
  government: "Claimed to be the IRS, Social Security, Medicare, police or a court",
  bank_or_fraud_team: "Claimed to be a bank or a fraud department",
  tech_support: "Claimed to be tech support or said a device or account was hacked",
  prize_or_lottery: "Said they'd won a prize, lottery or sweepstakes",
  courier_pickup: "Offered to send a courier or someone to collect money or cards",
  gift_cards: "Asked for gift cards",
  wire_or_crypto: "Asked for a wire transfer, payment app, cash or cryptocurrency",
  secrecy: "Asked to keep the call secret",
  urgency: "Pushed for money or action right away",
  asks_for_codes: "Asked for passwords, codes, PINs or account numbers",
  dodged_verification: "Avoided the code word or the call-back check",
} as const;
export type RiskCode = keyof typeof RISK_SIGNALS;
export const RISK_CODES = Object.keys(RISK_SIGNALS) as RiskCode[];

// Checks Redial itself ran, plus the caller ID checks from step 2.
export const CHECK_SIGNALS: Record<string, string> = {
  code_word_passed: "Gave the family code word",
  code_word_failed: "Didn't give the family code word",
  callback_started: "Redial called the person they claimed to be",
  callback_confirmed: "The person confirmed it was really them calling",
  callback_disproved: "The person they claimed to be is safe and wasn't on this call",
  callback_no_answer: "Couldn't reach the person they claimed to be",
  caller_id_failed: "The carrier couldn't confirm the caller ID",
  spoofed_number: "A known number, but the caller ID looked faked",
  family_number: "Called from a family member's confirmed number",
  invalid_number: "The caller ID isn't a real number",
  internet_number: "An internet calling number",
};

// Money-and-pressure signals: any of these with an unverified family claim
// makes a call a likely scam.
export const HARD_SIGNALS: RiskCode[] = ["bail_or_jail", "courier_pickup", "gift_cards", "wire_or_crypto", "secrecy", "asks_for_codes"];
