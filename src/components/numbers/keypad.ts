// Shared by the number search API and the picker.

export type NumberResult = { number: string; display: string; locality: string | null; region: string | null; sms: boolean; tollFree: boolean };

const KEYPAD: Record<string, string> = {
  a: "2", b: "2", c: "2", d: "3", e: "3", f: "3", g: "4", h: "4", i: "4", j: "5", k: "5", l: "5",
  m: "6", n: "6", o: "6", p: "7", q: "7", r: "7", s: "7", t: "8", u: "8", v: "8", w: "9", x: "9", y: "9", z: "9",
};

// "CALL" -> "2255": letters become keypad digits; anything else is dropped.
export const toDigits = (s: string) => s.toLowerCase().split("").map((c) => (/\d/.test(c) ? c : KEYPAD[c] ?? "")).join("");

// Where the picked number is kept until checkout (the purchase happens after payment).
export const PICK_KEY = "redial.picked-number";
