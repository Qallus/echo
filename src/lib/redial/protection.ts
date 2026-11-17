import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { decryptKey } from "@/lib/ai/keys";
import { logUsage, resolveCandidates, type ModelChoice, type Resolved } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import type { createAdminClient } from "@/lib/supabase/admin";
import { twilioLookup } from "@/lib/comms/twilio";
import { HARD_SIGNALS, RISK_CODES, RISK_SIGNALS, VERDICT_RANK, type RiskCode, type Verdict } from "./protection-shared";
import type { ListEntry, Turn } from "./types";

// Caller verification (fraud protection), step 2: what we can learn about a
// call before anyone speaks. Caller ID can be faked, so:
//  - Twilio passes the carrier's STIR/SHAKEN result (StirVerstat): whether
//    the calling carrier vouched that the caller really owns the number.
//  - Twilio Lookup says whether the number is real and what kind of line it
//    is (internet numbers are cheap to get and common in scams).
// The signals feed the routing (a "family" or VIP number that fails the
// carrier check gets screened instead of ringing through) and the assistant's
// instructions. Missing data is never treated as a red flag on its own.

type Db = ReturnType<typeof createAdminClient>;
export type Signal = { code: string; detail: string };
export type CallerCheck = {
  stir: string | null; lineType: string | null; signals: Signal[];
  // A known number (VIP, allow list, family) whose caller ID failed the carrier check.
  spoofSuspect: boolean;
  family: { name: string; relationship: string | null } | null;
};

export type Protection = { enabled: boolean; auto_block_scams: boolean; warn_on_courier: boolean; has_code_word: boolean };
export const PROTECTION_DEFAULT: Protection = { enabled: true, auto_block_scams: true, warn_on_courier: true, has_code_word: false };

export async function lineProtection(db: Db, lineId: string): Promise<Protection> {
  const { data } = await db.from("redial_protection").select("enabled, auto_block_scams, warn_on_courier, has_code_word").eq("line_id", lineId).maybeSingle();
  return data ?? PROTECTION_DEFAULT;
}

// StirVerstat values: TN-Validation-Passed-A/B/C, TN-Validation-Failed-A/B/C,
// No-TN-Validation (the carrier didn't sign the call; common and not proof).
const failed = (stir: string | null) => Boolean(stir && /Failed/i.test(stir));
const fullyVouched = (stir: string | null) => stir === "TN-Validation-Passed-A";

export async function checkCaller(db: Db, lineId: string, from: string | null, stirParam: string | undefined, entries: Pick<ListEntry, "number" | "kind">[]): Promise<CallerCheck> {
  const stir = stirParam?.trim() || null;
  const out: CallerCheck = { stir, lineType: null, signals: [], spoofSuspect: false, family: null };
  if (!from) return out;

  const { data: fam } = await db.from("redial_family").select("name, relationship").eq("line_id", lineId).eq("phone", from).limit(1).maybeSingle();
  out.family = fam ?? null;
  const listed = entries.find((e) => e.number === from && e.kind !== "block");

  if (failed(stir)) {
    out.signals.push({ code: "caller_id_failed", detail: "The calling carrier couldn't confirm this caller owns the number shown." });
    if (fam || listed) {
      out.spoofSuspect = true;
      out.signals.push({ code: "spoofed_number", detail: `The number belongs to ${fam ? fam.name : listed!.kind === "vip" ? "a VIP" : "someone on the allow list"}, but the caller ID didn't check out, so it may be faked.` });
    }
  } else if (fam && fullyVouched(stir)) {
    out.signals.push({ code: "family_number", detail: `Calling from ${fam.name}'s saved number, and the carrier confirmed it.` });
  }

  // Lookup only for callers we don't already know (saves cost and time).
  if (!listed || out.spoofSuspect) {
    const info = await twilioLookup(from);
    if (info) {
      out.lineType = info.lineType;
      if (!info.valid) out.signals.push({ code: "invalid_number", detail: "The caller ID isn't a real, assigned phone number." });
      else if (info.lineType === "nonFixedVoip") out.signals.push({ code: "internet_number", detail: `An internet calling number${info.carrier ? ` (${info.carrier})` : ""}, the kind scammers often use.` });
    }
  }
  return out;
}

// Facts for the assistant's instructions.
export function callFacts(c: { stir_verstat?: string | null; line_type?: string | null; risk_signals?: Signal[] | null }): string[] {
  const facts = (c.risk_signals ?? []).map((s) => s.detail);
  if (!facts.length && fullyVouched(c.stir_verstat ?? null)) facts.push("The calling carrier confirmed the caller owns this number.");
  return facts;
}

// ---------------------------------------------------------------------------
// Step 3: the assistant checks the story during the call.
// ---------------------------------------------------------------------------

export type FamilyMember = { id: string; name: string; relationship: string | null; phone: string | null; callback_ok: boolean };

export async function lineFamily(db: Db, lineId: string): Promise<FamilyMember[]> {
  const { data } = await db.from("redial_family").select("id, name, relationship, phone, callback_ok").eq("line_id", lineId).order("created_at").limit(30);
  return (data ?? []) as FamilyMember[];
}

// What the assistant is told about protection on this line. It never sees
// the code word or anyone's number.
export type ProtectBrief = { codeWord: boolean; callBack: boolean; courier: boolean; family: { name: string; relationship: string | null }[] };
export async function protectBrief(db: Db, lineId: string): Promise<ProtectBrief | null> {
  const p = await lineProtection(db, lineId);
  if (!p.enabled) return null;
  const family = await lineFamily(db, lineId);
  return {
    codeWord: p.has_code_word, courier: p.warn_on_courier,
    callBack: family.some((f) => f.callback_ok && f.phone),
    family: family.map((f) => ({ name: f.name, relationship: f.relationship })),
  };
}

// Spoken answers come through speech-to-text: compare letters and digits
// only, accept the word anywhere in what they said, and allow one slip in
// longer words ("bluebird" / "blue bird" / "blubird").
const squash = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
function within1(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
export function codeWordMatches(spoken: string, actual: string) {
  const said = squash(spoken), word = squash(actual);
  if (!said || !word) return false;
  if (said === word || said.includes(word)) return true;
  if (word.length < 5) return false;
  for (let len = word.length - 1; len <= word.length + 1; len++) {
    for (let i = 0; i + len <= said.length; i++) if (within1(said.slice(i, i + len), word)) return true;
  }
  return false;
}

export async function codeWordFor(db: Db, lineId: string): Promise<string | null> {
  const { data } = await db.from("redial_protection").select("enabled, code_word_cipher").eq("line_id", lineId).maybeSingle();
  if (!data?.enabled || !data.code_word_cipher) return null;
  try { return decryptKey(data.code_word_cipher); } catch { return null; }
}

// The family member a caller claims to be: by name, then by relationship.
export function matchFamily(claim: string, family: FamilyMember[]): FamilyMember | null {
  const c = claim.toLowerCase();
  const words = new Set(c.split(/[^a-z]+/).filter(Boolean));
  const byName = family.find((f) => f.name.toLowerCase().split(/\s+/).some((n) => n.length > 1 && words.has(n)));
  if (byName) return byName;
  const rel = (r: string | null) => (r ?? "").toLowerCase().replace(/s$/, "");
  return family.find((f) => f.relationship && words.has(rel(f.relationship))) ?? family.find((f) => f.relationship && c.includes(rel(f.relationship))) ?? null;
}

type CallRisk = { risk_signals: Signal[] | null; verdict: Verdict | null };

// Adds signals (once per code) and moves the verdict. A likely scam stays a
// likely scam unless Redial itself confirmed the caller (the code word or the
// call-back), and nothing turns "legit" while there's hard evidence against.
export async function recordRisk(db: Db, callId: string, add: Signal[], verdict?: Verdict | null, opts: { upgradeOnly?: boolean } = {}) {
  const { data } = await db.from("redial_calls").select("risk_signals, verdict").eq("id", callId).maybeSingle<CallRisk>();
  if (!data) return null;
  const signals = [...(data.risk_signals ?? [])];
  for (const s of add) if (!signals.some((x) => x.code === s.code)) signals.push({ code: s.code, detail: s.detail.slice(0, 300) });
  const has = (code: string) => signals.some((x) => x.code === code);
  const proven = has("code_word_passed") || has("callback_confirmed");
  let next: Verdict | null = data.verdict;
  if (verdict) {
    if (opts.upgradeOnly) next = !next || VERDICT_RANK[verdict] > VERDICT_RANK[next] ? verdict : next;
    else if (verdict === "legit") next = next === "likely_scam" && !proven ? next : "legit";
    else if (verdict === "unverified") next = next === "likely_scam" && !proven ? next : "unverified";
    else next = "likely_scam";
  }
  // The person they claimed to be answered and wasn't on the call: settled.
  if (has("callback_disproved")) next = "likely_scam";
  // A known number with faked-looking caller ID can't be "legit" without a check.
  else if (next === "legit" && has("spoofed_number") && !proven) next = "unverified";
  await db.from("redial_calls").update({ risk_signals: signals.slice(0, 40), verdict: next }).eq("id", callId);
  return next;
}

// A likely scam's number goes on the block list (when the line allows it).
export async function autoBlock(db: Db, lineId: string, number: string | null) {
  if (!number || !/^\+[1-9][0-9]{7,14}$/.test(number)) return false;
  const p = await lineProtection(db, lineId);
  if (!p.enabled || !p.auto_block_scams) return false;
  const { data: existing } = await db.from("redial_list_entries").select("kind").eq("line_id", lineId).eq("number", number).maybeSingle();
  if (existing) return existing.kind === "block";
  const { error } = await db.from("redial_list_entries").insert({ line_id: lineId, number, kind: "block", label: "Likely scam (blocked by Redial)" });
  return !error;
}

// After the call: a second read of the transcript, for signals the live
// assistant missed. It can raise the verdict, never lower it.
const review = z.object({
  signals: z.array(z.enum(RISK_CODES as [RiskCode, ...RiskCode[]])).describe("Every red flag that clearly happened on the call"),
  verdict: z.enum(["legit", "unverified", "likely_scam"]),
  reason: z.string().describe("One sentence, plain words"),
});

export async function reviewCall(db: Db, callId: string) {
  const { data: call } = await db.from("redial_calls").select("id, line_id, from_number, transcript, verdict, risk_signals").eq("id", callId).maybeSingle();
  if (!call) return;
  const p = await lineProtection(db, call.line_id);
  const turns = ((call.transcript ?? []) as Turn[]).filter((t) => t.text?.trim());
  if (!p.enabled || turns.filter((t) => t.role === "caller").length < 2) return;
  const text = turns.slice(-80).map((t) => `${t.role === "caller" ? "Caller" : "Assistant"}: ${t.text}`).join("\n").slice(-12000);
  const checked = ((call.risk_signals ?? []) as Signal[]).map((s) => s.detail).join("; ") || "nothing";
  const system = `You review a phone call that an AI assistant screened for someone, looking for phone scams (family emergency or "grandparent" scams, fake police, lawyers or bail, government agencies, banks or fraud departments, tech support, prizes, couriers collecting money, gift cards, wires, crypto, secrecy, pressure).
Flag only what clearly happened. A caller saying they're family is "claims_family" on its own; it isn't a scam unless money, pressure or secrecy come with it and they weren't verified.
Verdict: likely_scam when the call follows a known scam pattern; unverified when the caller's identity mattered and couldn't be confirmed; legit otherwise.
What Redial already checked: ${checked}.`;

  const settings = await getAiSettings(db);
  const order = (settings.summaryOrder as ModelChoice[]).filter((m, i, a) => !!m && a.indexOf(m) === i);
  const attempts: Resolved[] = [];
  for (const choice of order) attempts.push(...(await resolveCandidates(db, choice, { settings, keys: [] })));
  for (const [i, picked] of attempts.entries()) {
    const started = Date.now();
    try {
      const { output, usage } = await generateText({ model: picked.model, system, prompt: text, output: Output.object({ schema: review }) });
      void logUsage(db, { feature: "summary", resolved: picked, fallback: i > 0, settings, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, latencyMs: Date.now() - started });
      const found = output.signals.filter((c) => RISK_SIGNALS[c]).map((c) => ({ code: c, detail: RISK_SIGNALS[c] }));
      // A family claim with money pressure, never verified, is a likely scam even if the model hedged.
      const codes = new Set([...found.map((f) => f.code as string), ...((call.risk_signals ?? []) as Signal[]).map((s) => s.code)]);
      const verified = codes.has("code_word_passed") || codes.has("callback_confirmed");
      const forced = codes.has("claims_family") && !verified && HARD_SIGNALS.some((h) => codes.has(h)) ? "likely_scam" : null;
      const next = await recordRisk(db, callId, found, forced ?? output.verdict, { upgradeOnly: true });
      if (next === "likely_scam" && call.verdict !== "likely_scam") await autoBlock(db, call.line_id, call.from_number);
      return;
    } catch (e) {
      const message = `${picked.label}: ${e instanceof Error ? e.message : String(e)}`;
      void logUsage(db, { feature: "summary", resolved: picked, fallback: i > 0, settings, ok: false, error: message, latencyMs: Date.now() - started });
    }
  }
}
