import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { twilioLookup } from "@/lib/comms/twilio";
import type { ListEntry } from "./types";

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

// Facts for the assistant's instructions (step 3 adds the checks that use them).
export function callFacts(c: { stir_verstat?: string | null; line_type?: string | null; risk_signals?: Signal[] | null }): string[] {
  const facts = (c.risk_signals ?? []).map((s) => s.detail);
  if (!facts.length && fullyVouched(c.stir_verstat ?? null)) facts.push("The calling carrier confirmed the caller owns this number.");
  return facts;
}
