// SMS pricing (Admin → Billing → SMS billing). All amounts in cents.
// A text's price = (Twilio's price per segment + the carrier fee) plus the
// markup. Packs and monthly plans also cover Stripe's fee, so even a small
// pack keeps the markup.

export type SmsBilling = {
  costPerSegment: number; // Twilio, per 160-character segment, US
  carrierFee: number; // US carrier (10DLC) fee per segment
  mmsCost: number; // a picture message, Twilio + carrier
  markupPercent: number; // on top of cost
  stripePercent: number; // Stripe's card fee
  stripeFixedCents: number; // Stripe's per-charge fee
  freeTexts: number; // texts a month every line owner gets
};

export const DEFAULT_SMS_BILLING: SmsBilling = {
  costPerSegment: 0.83, carrierFee: 0.3, mmsCost: 2.2, markupPercent: 10, stripePercent: 2.9, stripeFixedCents: 30, freeTexts: 25,
};

export function parseSmsBilling(value: unknown): SmsBilling {
  const v = (value ?? {}) as Partial<SmsBilling>;
  const num = (x: unknown, d: number, max: number) => (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max ? x : d);
  const d = DEFAULT_SMS_BILLING;
  return {
    costPerSegment: num(v.costPerSegment, d.costPerSegment, 100), carrierFee: num(v.carrierFee, d.carrierFee, 100),
    mmsCost: num(v.mmsCost, d.mmsCost, 500), markupPercent: num(v.markupPercent, d.markupPercent, 500),
    stripePercent: num(v.stripePercent, d.stripePercent, 20), stripeFixedCents: num(v.stripeFixedCents, d.stripeFixedCents, 500),
    freeTexts: Math.round(num(v.freeTexts, d.freeTexts, 100000)),
  };
}

/** Redial's cost for one text segment. */
export const costPerText = (s: SmsBilling) => s.costPerSegment + s.carrierFee;
/** What a customer pays for one text segment, before card fees. */
export const pricePerText = (s: SmsBilling) => costPerText(s) * (1 + s.markupPercent / 100);
/** A pack or monthly plan of `count` texts: cost + markup, with Stripe's fee covered. Whole cents. */
export function suggestedPrice(count: number, s: SmsBilling): number {
  const net = count * pricePerText(s);
  return Math.ceil((net + s.stripeFixedCents) / (1 - s.stripePercent / 100));
}
/** What Redial keeps from a pack sold at `price` cents, after Twilio, carriers and Stripe. */
export function profitOn(count: number, price: number, s: SmsBilling): number {
  return price - price * (s.stripePercent / 100) - s.stripeFixedCents - count * costPerText(s);
}

// How many segments a text takes: 160 characters (153 each when split) for
// plain text, 70 (67 each) when it has emoji or other non-GSM characters.
const GSM = /^[A-Za-z0-9 @£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/;
export function segmentsOf(body: string): number {
  if (!body) return 1;
  const gsm = GSM.test(body);
  const len = gsm ? [...body].reduce((n, c) => n + ("^{}\\[~]|€".includes(c) ? 2 : 1), 0) : [...body].length;
  const single = gsm ? 160 : 70, multi = gsm ? 153 : 67;
  return Math.min(20, len <= single ? 1 : Math.ceil(len / multi));
}

export const cents = (c: number, digits = 2) => `$${(c / 100).toFixed(digits)}`;
