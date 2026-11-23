// Areas an agent can be limited to (Admin > AI > Agents). Each maps to tool
// domains: a tool's domain is its name's first word (echo_recording_list ->
// recording), or set explicitly (resource_* -> resource). No imports: shared
// with the admin page.
export const AGENT_AREAS = [
  { id: "records", label: "CRM, bookings, plans, documents and calendar", domains: ["resource", "crm", "bookings", "plans", "documents"] },
  { id: "prospects", label: "Prospects (find businesses, carrier lookups, to leads)", domains: ["prospects"] },
  { id: "research", label: "Web search and lead research", domains: ["research"] },
  { id: "social", label: "Social posts (draft and schedule; publishing now asks a person)", domains: ["social"] },
  { id: "comms", label: "Inbox and texts (reply, save to CRM, send a text)", domains: ["comms"] },
  { id: "insights", label: "Reports, analytics and the app waitlist", domains: ["reports", "analytics", "waitlist"] },
  { id: "recordings", label: "Recordings, transcripts and summaries", domains: ["folder", "recording", "search", "transcript", "segment", "highlight", "summary", "action", "design"] },
  { id: "email", label: "Email (templates, audiences, sends)", domains: ["email"] },
  { id: "backlog", label: "Developer backlog", domains: ["dev"] },
  { id: "redial", label: "Redial lines, call trees and the Recording Studio", domains: ["redial", "call_tree", "studio"] },
  { id: "live_agents", label: "Live Agents marketplace", domains: ["live_agents"] },
  { id: "billing", label: "Billing (catalog, prices, promo codes, refunds)", domains: ["billing"] },
  { id: "admin", label: "Admin: users, staff, settings and integrations", domains: ["admin"] },
  { id: "account", label: "Account, notifications and activity", domains: ["account", "whoami", "workspace", "member", "audit"] },
] as const;

export const domainsFor = (areas: string[]) => AGENT_AREAS.filter((a) => areas.includes(a.id)).flatMap((a) => [...a.domains]);
export const areasFor = (domains: string[]) => AGENT_AREAS.filter((a) => a.domains.some((d) => domains.includes(d))).map((a) => a.id);

export const HARNESSES = [
  { id: "paperclip", label: "Paperclip" }, { id: "hermes", label: "Hermes" }, { id: "openclaw", label: "OpenClaw" },
  { id: "herdr", label: "Herdr" }, { id: "chatgpt", label: "ChatGPT" }, { id: "claude", label: "Claude" }, { id: "other", label: "Other" },
] as const;
