// Promo code rules, shared by Admin -> Billing -> Promo codes and the cart.
//
// The discount itself is a Stripe coupon + promotion code, so Stripe enforces
// what it can natively: the amount, how long it lasts on a subscription, the
// expiry, total uses, minimum order, first-time customers and which products
// it covers. Echo adds the rest and stores them in the promotion code's
// metadata (editable later): start date, maximum order, uses per customer,
// one customer's email, and a private note. Customers enter codes in the cart
// (Echo checks every rule), never on Stripe's page.

export type PromoDuration = "once" | "repeating" | "forever";

export type PromoRules = {
  startsAt: string | null; // ISO
  maxOrder: number | null; // cents
  perCustomer: number | null;
  email: string | null;
  products: string[]; // catalog product ids; empty = everything
  note: string;
};

export type PromoRow = PromoRules & {
  id: string;
  code: string;
  name: string;
  active: boolean;
  percentOff: number | null;
  amountOff: number | null; // cents
  duration: PromoDuration;
  months: number | null;
  expiresAt: string | null; // ISO
  maxUses: number | null;
  used: number;
  minOrder: number | null; // cents
  firstTimeOnly: boolean;
  created: string; // ISO
  given: number; // cents discounted on orders so far
  orders: number;
};

export type PromoStatus = "active" | "scheduled" | "expired" | "used_up" | "off";

export function promoStatus(p: Pick<PromoRow, "active" | "startsAt" | "expiresAt" | "maxUses" | "used">, now = Date.now()): PromoStatus {
  if (!p.active) return "off";
  if (p.expiresAt && Date.parse(p.expiresAt) <= now) return "expired";
  if (p.maxUses != null && p.used >= p.maxUses) return "used_up";
  if (p.startsAt && Date.parse(p.startsAt) > now) return "scheduled";
  return "active";
}

export const STATUS_LABEL: Record<PromoStatus, string> = { active: "Active", scheduled: "Scheduled", expired: "Expired", used_up: "Used up", off: "Off" };

const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export function discountLabel(p: { percentOff: number | null; amountOff: number | null; duration: PromoDuration; months: number | null }) {
  const off = p.percentOff ? `${p.percentOff}% off` : `${usd(p.amountOff ?? 0)} off`;
  const length = p.duration === "forever" ? "every payment" : p.duration === "repeating" ? `for ${p.months} month${p.months === 1 ? "" : "s"}` : "the first payment";
  return `${off} ${length}`;
}

// Dates are picked as days in Arizona time (no daylight saving): a code starts
// at midnight and expires at the end of its last day.
export const dayStart = (day: string) => new Date(`${day}T00:00:00-07:00`).toISOString();
export const dayEnd = (day: string) => new Date(`${day}T23:59:59-07:00`).toISOString();
export const toDay = (iso: string | null) => (iso ? new Date(Date.parse(iso) - 7 * 3600_000).toISOString().slice(0, 10) : "");
export const showDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Phoenix" }) : "");

// Metadata <-> rules. Stripe metadata values are strings (max 500 chars).
export function rulesFromMetadata(m: Record<string, string> | null | undefined): PromoRules {
  const n = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);
  return {
    startsAt: m?.starts_at || null,
    maxOrder: n(m?.max_order),
    perCustomer: n(m?.per_customer),
    email: m?.email || null,
    products: (m?.products ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    note: m?.note ?? "",
  };
}

export function rulesToMetadata(r: PromoRules): Record<string, string> {
  // An empty string removes the key in Stripe.
  return {
    starts_at: r.startsAt ?? "",
    max_order: r.maxOrder != null ? String(r.maxOrder) : "",
    per_customer: r.perCustomer != null ? String(r.perCustomer) : "",
    email: r.email ?? "",
    products: r.products.join(",").slice(0, 500),
    note: r.note.slice(0, 500),
  };
}
