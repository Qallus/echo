// Echo's catalog. Prices here are the source of truth for the store pages;
// scripts/stripe-setup.mjs creates matching Stripe products and prices, each
// with a lookup_key equal to the `key` below. Amounts are in US cents.

export type Interval = "month" | "year";
export type Kind = "plan" | "bolt_on" | "pack" | "service";

// Graduated per-seat tiers (Stripe "graduated" tiered pricing).
export type Tier = { upTo: number | null; unitAmount: number };

export type Price = {
  key: string; // Stripe lookup_key
  interval: Interval | null; // null = one-time
  unitAmount?: number;
  tiers?: Tier[];
};

export type Product = {
  id: string;
  kind: Kind;
  name: string;
  tagline: string;
  features?: string[];
  perSeat?: boolean;
  prices: Price[];
};

export const PRODUCTS: Product[] = [
  {
    id: "pro", kind: "plan", name: "Pro", tagline: "For your own calls and meetings.",
    features: ["2,000 transcription minutes a month", "Unlimited history and storage", "Claude, ChatGPT and Grok in Ask Echo", "Branded PDF and web reports", "Claude connector"],
    prices: [
      { key: "pro_monthly", interval: "month", unitAmount: 1500 },
      { key: "pro_annual", interval: "year", unitAmount: 14400 },
    ],
  },
  {
    id: "business", kind: "plan", name: "Business", tagline: "For teams that share recordings.", perSeat: true,
    features: ["Everything in Pro, per seat", "Shared Business workspace", "Admins and member roles", "The more seats, the lower the price per seat", "Priority support"],
    prices: [
      { key: "business_monthly", interval: "month", tiers: [{ upTo: 5, unitAmount: 2000 }, { upTo: 20, unitAmount: 1700 }, { upTo: null, unitAmount: 1400 }] },
      { key: "business_annual", interval: "year", tiers: [{ upTo: 5, unitAmount: 20000 }, { upTo: 20, unitAmount: 17000 }, { upTo: null, unitAmount: 14000 }] },
    ],
  },
  { id: "api", kind: "bolt_on", name: "API & webhooks", tagline: "Pipe recordings, transcripts and summaries into your platform.", prices: [{ key: "bolt_api_monthly", interval: "month", unitAmount: 1900 }] },
  { id: "crm", kind: "bolt_on", name: "CRM sync", tagline: "Summaries and action items on HubSpot, Salesforce or GoHighLevel records.", prices: [{ key: "bolt_crm_monthly", interval: "month", unitAmount: 2900 }] },
  { id: "bot", kind: "bolt_on", name: "Meeting bot", tagline: "Joins Zoom, Meet and Teams from your calendar and records for you.", prices: [{ key: "bolt_bot_monthly", interval: "month", unitAmount: 4900 }] },
  { id: "phone", kind: "bolt_on", name: "Phone line", tagline: "A number that records and transcribes your calls.", prices: [{ key: "bolt_phone_monthly", interval: "month", unitAmount: 1500 }] },
  { id: "whitelabel", kind: "bolt_on", name: "White-label", tagline: "Your logo, colors and domain on share pages and emails.", prices: [{ key: "bolt_whitelabel_monthly", interval: "month", unitAmount: 4900 }] },
  { id: "translate", kind: "bolt_on", name: "Translation", tagline: "Transcripts and summaries in 30+ languages.", prices: [{ key: "bolt_translate_monthly", interval: "month", unitAmount: 1000 }] },
  { id: "min500", kind: "pack", name: "500 minutes", tagline: "Extra transcription minutes. Valid for 12 months.", prices: [{ key: "pack_minutes_500", interval: null, unitAmount: 1000 }] },
  { id: "min2000", kind: "pack", name: "2,000 minutes", tagline: "Extra transcription minutes. Valid for 12 months.", prices: [{ key: "pack_minutes_2000", interval: null, unitAmount: 3500 }] },
  { id: "min5000", kind: "pack", name: "5,000 minutes", tagline: "Extra transcription minutes. Valid for 12 months.", prices: [{ key: "pack_minutes_5000", interval: null, unitAmount: 7500 }] },
  { id: "onboarding", kind: "service", name: "Guided onboarding", tagline: "A 60-minute session to set up workspaces, templates and the Claude connector for your team.", prices: [{ key: "svc_onboarding", interval: null, unitAmount: 29900 }] },
  { id: "templates", kind: "service", name: "Custom template pack", tagline: "Three summary templates written for your calls (sales, support, interviews…).", prices: [{ key: "svc_templates", interval: null, unitAmount: 14900 }] },
  { id: "integration", kind: "service", name: "Custom integration", tagline: "We connect Echo to your platform with the API and webhooks. Scoped on a call first.", prices: [{ key: "svc_integration", interval: null, unitAmount: 150000 }] },
];

export const KIND_LABEL: Record<Kind, string> = { plan: "Plans", bolt_on: "Bolt-ons", pack: "Minute packs", service: "Services" };

export function findPrice(key: string): { product: Product; price: Price } | null {
  for (const product of PRODUCTS) {
    const price = product.prices.find((p) => p.key === key);
    if (price) return { product, price };
  }
  return null;
}

// Total for a quantity, applying graduated tiers.
export function amountFor(price: Price, quantity: number): number {
  if (!price.tiers) return (price.unitAmount ?? 0) * quantity;
  let total = 0;
  let from = 0;
  for (const t of price.tiers) {
    const to = t.upTo ?? Infinity;
    const n = Math.max(0, Math.min(quantity, to) - from);
    total += n * t.unitAmount;
    from = to;
    if (quantity <= to) break;
  }
  return total;
}

export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export const per = (interval: Interval | null) => (interval === "month" ? "/mo" : interval === "year" ? "/yr" : "");
