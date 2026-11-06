// Who a bulk email goes to: a filter over one source, resolved when the email
// is sent (so a saved audience stays current). Shared by the admin screens,
// the server and the Claude connector; no server imports here.
//   contacts:  CRM contacts with an email, by role, status, lead status, tags, owner
//   waitlist:  app waitlist people who agreed to email, by product and topic
//   customers: signed-up Echo/Redial accounts, by account type and plan

export const CONTACT_ROLES = ["contact", "lead", "prospect", "client", "partner"] as const;
export const CONTACT_STATUSES = ["active", "inactive", "archived"] as const;
export const LEAD_STATUSES = ["new", "attempting", "contacted", "nurture", "qualified", "disqualified", "in_pipeline"] as const;
export const WAITLIST_PRODUCTS = ["echo", "redial"] as const;
export const WAITLIST_TOPICS = ["launch", "beta", "features", "tips", "offers"] as const;
export const WAITLIST_STATUSES = ["waiting", "notified", "invited", "joined"] as const;
export const ACCOUNT_TYPES = ["personal", "team", "business"] as const;
export const PLANS = ["paying", "trial", "free"] as const;

export type Audience =
  | { source: "contacts"; roles?: string[]; statuses?: string[]; leadStatuses?: string[]; tags?: string[]; tagMode?: "any" | "all"; ownerIds?: string[] }
  | { source: "waitlist"; products?: string[]; topics?: string[]; statuses?: string[] }
  | { source: "customers"; accountTypes?: string[]; plans?: string[] };

export const SOURCES = [
  { id: "contacts", label: "CRM contacts", detail: "Contacts with an email address. Archived contacts are left out unless you pick them." },
  { id: "waitlist", label: "App waitlist", detail: "Only people who agreed to email updates." },
  { id: "customers", label: "Customers", detail: "Everyone with a confirmed Echo or Redial account (not suspended)." },
] as const;

const pick = (v: unknown, allowed: readonly string[]) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : [];
const tagList = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 20) : [];
const uuidList = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50) : [];

// Only known sources and values get through (input from forms and Claude).
export function parseAudience(raw: unknown): Audience | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (a.source === "contacts") {
    return {
      source: "contacts", roles: pick(a.roles, CONTACT_ROLES), statuses: pick(a.statuses, CONTACT_STATUSES), leadStatuses: pick(a.leadStatuses, LEAD_STATUSES),
      tags: tagList(a.tags), tagMode: a.tagMode === "all" ? "all" : "any", ownerIds: uuidList(a.ownerIds),
    };
  }
  if (a.source === "waitlist") return { source: "waitlist", products: pick(a.products, WAITLIST_PRODUCTS), topics: pick(a.topics, WAITLIST_TOPICS), statuses: pick(a.statuses, WAITLIST_STATUSES) };
  if (a.source === "customers") return { source: "customers", accountTypes: pick(a.accountTypes, ACCOUNT_TYPES), plans: pick(a.plans, PLANS) };
  return null;
}

const words = (label: string, v?: string[]) => (v?.length ? `${label} ${v.map((x) => x.replace(/_/g, " ")).join(" or ")}` : null);

// "CRM contacts · role lead or prospect · tagged newsletter"
export function audienceLabel(a: Audience): string {
  const parts = a.source === "contacts"
    ? ["CRM contacts", words("role", a.roles), words("status", a.statuses), words("lead status", a.leadStatuses),
      a.tags?.length ? `tagged ${a.tags.join(a.tagMode === "all" ? " and " : " or ")}` : null, a.ownerIds?.length ? `${a.ownerIds.length} owner${a.ownerIds.length > 1 ? "s" : ""}` : null]
    : a.source === "waitlist"
      ? ["App waitlist", words("product", a.products), words("topic", a.topics), words("status", a.statuses)]
      : ["Customers", words("account", a.accountTypes), words("plan", a.plans)];
  return parts.filter(Boolean).join(" · ");
}
