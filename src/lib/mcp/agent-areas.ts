// Areas an agent can be limited to (Admin > AI > Agents). Each maps to tool
// domains: a tool's domain is its name's first word (echo_recording_list ->
// recording), or set explicitly (resource_* -> resource). No imports: shared
// with the admin page.
export const AGENT_AREAS = [
  { id: "records", label: "CRM, bookings, plans, documents and calendar", domains: ["resource", "crm", "bookings", "plans", "documents"] },
  { id: "insights", label: "Reports, analytics and the app waitlist", domains: ["reports", "analytics", "waitlist"] },
  { id: "recordings", label: "Recordings, transcripts and summaries", domains: ["folder", "recording", "search", "transcript", "segment", "highlight", "summary", "action", "design"] },
  { id: "email", label: "Email (templates, audiences, sends)", domains: ["email"] },
  { id: "backlog", label: "Developer backlog", domains: ["dev"] },
  { id: "account", label: "Account and activity", domains: ["whoami", "workspace", "member", "audit"] },
] as const;

export const domainsFor = (areas: string[]) => AGENT_AREAS.filter((a) => areas.includes(a.id)).flatMap((a) => [...a.domains]);
export const areasFor = (domains: string[]) => AGENT_AREAS.filter((a) => a.domains.some((d) => domains.includes(d))).map((a) => a.id);

export const HARNESSES = [
  { id: "paperclip", label: "Paperclip" }, { id: "hermes", label: "Hermes" }, { id: "openclaw", label: "OpenClaw" },
  { id: "herdr", label: "Herdr" }, { id: "chatgpt", label: "ChatGPT" }, { id: "claude", label: "Claude" }, { id: "other", label: "Other" },
] as const;
