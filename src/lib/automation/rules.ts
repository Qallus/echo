// Automation rules: when something happens (trigger), if the record matches
// (conditions), do these things (actions). Shared by the builder and the
// runner in ./run.ts. Mirrors public.automation_rules
// (supabase/migrations/20261104110000_batch_d.sql).

export type Subject = "deal" | "contact" | "booking" | "message";

export const RULE_TRIGGERS = [
  { id: "lead_created", label: "A lead is added", subject: "contact" },
  { id: "added_to_pipeline", label: "A deal is added to the pipeline", subject: "deal" },
  { id: "stage_changed", label: "A deal moves to a stage", subject: "deal" },
  { id: "closed_won", label: "A deal is won", subject: "deal" },
  { id: "closed_lost", label: "A deal is lost", subject: "deal" },
  { id: "next_step_overdue", label: "A deal's next step is overdue", subject: "deal" },
  { id: "deal_stalled", label: "A deal has had no activity for a while", subject: "deal" },
  { id: "booking_created", label: "Someone books a meeting", subject: "booking" },
  { id: "inbox_message", label: "An email or website message arrives", subject: "message" },
] as const satisfies readonly { id: string; label: string; subject: Subject }[];
export type RuleTrigger = (typeof RULE_TRIGGERS)[number]["id"];
export const subjectOf = (t: RuleTrigger): Subject => RULE_TRIGGERS.find((x) => x.id === t)!.subject;
export const triggerLabel = (t: string) => RULE_TRIGGERS.find((x) => x.id === t)?.label ?? t;

// Fields a condition can test, per subject. Deal rules can also test the
// deal's contact.
export type FieldKind = "text" | "number" | "stage" | "choice";
export type FieldDef = { key: string; label: string; kind: FieldKind; choices?: string[] };

const CONTACT_FIELDS: FieldDef[] = [
  { key: "contact.source", label: "Contact source", kind: "text" },
  { key: "contact.role", label: "Contact type", kind: "choice", choices: ["contact", "lead", "prospect", "client", "partner"] },
  { key: "contact.lead_status", label: "Lead status", kind: "choice", choices: ["new", "attempting", "contacted", "nurture", "qualified", "disqualified", "in_pipeline"] },
  { key: "contact.tags", label: "Contact tags", kind: "text" },
  { key: "contact.email", label: "Contact email", kind: "text" },
  { key: "contact.phone", label: "Contact phone", kind: "text" },
  { key: "contact.state", label: "Contact state", kind: "text" },
];

export const FIELDS: Record<Subject, FieldDef[]> = {
  deal: [
    { key: "deal.title", label: "Deal name", kind: "text" },
    { key: "deal.stage", label: "Stage", kind: "stage" },
    { key: "deal.value", label: "Value ($)", kind: "number" },
    { key: "deal.probability", label: "Probability (%)", kind: "number" },
    { key: "deal.source", label: "Deal source", kind: "text" },
    { key: "deal.opportunity_type", label: "Opportunity type", kind: "text" },
    ...CONTACT_FIELDS,
  ],
  contact: CONTACT_FIELDS,
  booking: [
    { key: "booking.type", label: "Meeting type", kind: "text" },
    { key: "booking.title", label: "Booking title", kind: "text" },
    { key: "booking.location", label: "Location", kind: "text" },
    { key: "booking.source", label: "Booked from", kind: "choice", choices: ["website", "dashboard"] },
    { key: "booking.email", label: "Guest email", kind: "text" },
    { key: "booking.company", label: "Guest company", kind: "text" },
  ],
  message: [
    { key: "message.channel", label: "Channel", kind: "choice", choices: ["email", "form"] },
    { key: "message.topic", label: "Topic", kind: "text" },
    { key: "message.subject", label: "Subject", kind: "text" },
    { key: "message.from_email", label: "From email", kind: "text" },
    { key: "message.body", label: "Message", kind: "text" },
  ],
};

export const OPS = [
  { id: "is", label: "is" }, { id: "is_not", label: "is not" }, { id: "contains", label: "contains" },
  { id: "not_contains", label: "doesn't contain" }, { id: "gt", label: "is more than" }, { id: "lt", label: "is less than" },
  { id: "is_set", label: "is filled in" }, { id: "is_empty", label: "is empty" },
] as const;
export type Op = (typeof OPS)[number]["id"];
export const opsFor = (kind: FieldKind): Op[] =>
  kind === "number" ? ["is", "is_not", "gt", "lt", "is_set", "is_empty"]
  : kind === "text" ? ["is", "is_not", "contains", "not_contains", "is_set", "is_empty"]
  : ["is", "is_not"];
export const needsValue = (op: Op) => op !== "is_set" && op !== "is_empty";

export type Condition = { field: string; op: Op; value: string };

export type RuleAction =
  | { type: "send_email"; to: "contact" | "owner" | "custom"; email?: string; templateId: string }
  | { type: "send_sms"; to: "contact" | "custom"; phone?: string; body: string }
  | { type: "create_task"; title: string; dueInDays: number }
  | { type: "assign_owner"; userId: string }
  | { type: "notify_staff"; userId: string; title: string }
  | { type: "webhook"; url: string };
export type ActionType = RuleAction["type"];

export const ACTIONS: { type: ActionType; label: string; hint: string }[] = [
  { type: "send_email", label: "Send an email", hint: "From an email template, to the contact, the owner or an address." },
  { type: "send_sms", label: "Send a text", hint: "From the notification number. Numbers that replied STOP are skipped." },
  { type: "create_task", label: "Create a task", hint: "On the deal or contact, due in a number of days." },
  { type: "assign_owner", label: "Assign an owner", hint: "Sets the deal's or contact's owner." },
  { type: "notify_staff", label: "Notify a team member", hint: "An in-app notification, plus email or text if they've turned that on." },
  { type: "webhook", label: "Call a webhook", hint: "POSTs the record as JSON to an https URL, signed when a webhook secret is set." },
];

export const MERGE_HINT = "{{first_name}}, {{full_name}}, {{deal}}, {{stage}}, {{amount}}, {{when}}, {{subject}}";

export function blankAction(type: ActionType): RuleAction {
  switch (type) {
    case "send_email": return { type, to: "contact", templateId: "" };
    case "send_sms": return { type, to: "contact", body: "Hi {{first_name}}, " };
    case "create_task": return { type, title: "Follow up with {{full_name}}", dueInDays: 1 };
    case "assign_owner": return { type, userId: "" };
    case "notify_staff": return { type, userId: "owner", title: "" };
    case "webhook": return { type, url: "https://" };
  }
}

export type Rule = {
  id: string; name: string; description: string | null; enabled: boolean; trigger: RuleTrigger; stage: string | null;
  stalled_days: number; delay_minutes: number; match: "all" | "any"; conditions: Condition[]; actions: RuleAction[];
  runs: number; last_run_at: string | null; created_at: string; created_by?: string | null;
};

export type RuleRun = {
  id: string; rule_id: string; status: "queued" | "done" | "skipped" | "failed"; detail: string | null;
  results: { type: ActionType; ok: boolean; detail?: string }[]; run_at: string; created_at: string;
  deal_id: string | null; contact_id: string | null; booking_id: string | null; message_id: string | null;
};

// A flat view of the record a rule runs on: "deal.stage" -> "proposal".
export type Context = Record<string, string | number | null>;

export function matches(ctx: Context, conditions: Condition[], match: "all" | "any") {
  if (!conditions.length) return true;
  const test = (c: Condition) => {
    const raw = ctx[c.field];
    const v = raw == null ? "" : String(raw).toLowerCase();
    const want = (c.value ?? "").trim().toLowerCase();
    switch (c.op) {
      case "is": return v === want;
      case "is_not": return v !== want;
      case "contains": return want !== "" && v.includes(want);
      case "not_contains": return want === "" || !v.includes(want);
      case "gt": return raw != null && raw !== "" && Number(raw) > Number(want);
      case "lt": return raw != null && raw !== "" && Number(raw) < Number(want);
      case "is_set": return v !== "";
      case "is_empty": return v === "";
    }
  };
  return match === "all" ? conditions.every(test) : conditions.some(test);
}

// Checks a rule before saving. Returns an error message, or null.
export function validateRule(r: Pick<Rule, "name" | "trigger" | "conditions" | "actions">): string | null {
  if (!r.name.trim()) return "Give the rule a name.";
  if (!RULE_TRIGGERS.some((t) => t.id === r.trigger)) return "Choose a trigger.";
  if (r.conditions.length > 20) return "Up to 20 conditions.";
  const fields = FIELDS[subjectOf(r.trigger)].map((f) => f.key);
  for (const c of r.conditions) {
    if (!fields.includes(c.field)) return "A condition uses a field this trigger doesn't have.";
    if (needsValue(c.op) && !c.value.trim()) return "Fill in every condition's value.";
  }
  if (!r.actions.length) return "Add at least one action.";
  if (r.actions.length > 10) return "Up to 10 actions.";
  for (const a of r.actions) {
    if (a.type === "send_email" && (!a.templateId || (a.to === "custom" && !/^\S+@\S+\.\S+$/.test(a.email ?? "")))) return "Each email needs a template and a recipient.";
    if (a.type === "send_sms" && (!a.body.trim() || a.body.length > 1000 || (a.to === "custom" && !(a.phone ?? "").trim()))) return "Each text needs a message (up to 1,000 characters) and a recipient.";
    if (a.type === "create_task" && (!a.title.trim() || a.dueInDays < 0 || a.dueInDays > 365)) return "Each task needs a title and a due date within a year.";
    if (a.type === "assign_owner" && !a.userId) return "Choose who to assign.";
    if (a.type === "notify_staff" && (!a.userId || !a.title.trim())) return "Each notification needs a person and a title.";
    if (a.type === "webhook" && !isSafeWebhookUrl(a.url)) return "Webhooks need a public https:// URL.";
  }
  return null;
}

// https only, and not localhost or a private/link-local address.
export function isSafeWebhookUrl(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".") && !h.includes(":")) return false;
  if (/^(0|10|127)\./.test(h) || /^169\.254\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return false;
  if (h.includes(":") && (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:"))) return false;
  return true;
}
