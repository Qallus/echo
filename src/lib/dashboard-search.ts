// Dashboard search: every page in the user and admin dashboards, with words
// people might type for it. Used by the search panel in the top bar (works
// like the website's search: pick an area, type, use the arrow keys).

export type DashCategory = "all" | "pages" | "calls" | "recordings" | "settings" | "admin";
export type DashEntry = {
  cat: Exclude<DashCategory, "all">; title: string; href: string; desc: string; icon: string;
  keywords?: string; permission?: string; when?: "phoneLine" | "liveAgent";
};

export const DASH_CATEGORIES: { id: DashCategory; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "search" },
  { id: "pages", label: "Dashboard", icon: "layout-dashboard" },
  { id: "calls", label: "Calls", icon: "phone" },
  { id: "recordings", label: "Recordings", icon: "audio-lines" },
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "admin", label: "Admin", icon: "shield-check" },
];

export const DASH_ENTRIES: DashEntry[] = [
  // User dashboard
  { cat: "pages", title: "Home", href: "/home", desc: "Recent files and what's new", icon: "home", keywords: "dashboard start recent" },
  { cat: "pages", title: "Ask Echo", href: "/ask", desc: "Chat with AI about your recordings", icon: "sparkles", keywords: "ai chat question claude chatgpt grok" },
  { cat: "pages", title: "Shared with me", href: "/shared", desc: "Recordings others shared with you", icon: "users" },
  { cat: "pages", title: "Calendar", href: "/calendar", desc: "Appointments, events and deadlines", icon: "calendar-days", keywords: "schedule booking event deadline" },
  { cat: "pages", title: "Templates", href: "/templates", desc: "Summary templates for recordings", icon: "layout-template" },
  { cat: "pages", title: "Explore", href: "/explore", desc: "Features and ideas to try", icon: "compass" },
  { cat: "pages", title: "Search Live Agents", href: "/agents", desc: "Book real people to answer your calls", icon: "headset", keywords: "hire receptionist person human" },
  { cat: "pages", title: "My Live Agents", href: "/hiring", desc: "Agents you hired, offers and booked work", icon: "briefcase", keywords: "hire offer hiring" },
  { cat: "pages", title: "AI Agents", href: "/agents/ai", desc: "Your call assistant and AI helpers", icon: "bot", keywords: "ai assistant" },
  { cat: "pages", title: "Notifications", href: "/notifications", desc: "Everything Redial told you", icon: "bell", keywords: "alerts" },
  { cat: "pages", title: "Archive", href: "/library/archive", desc: "Files kept out of the way", icon: "archive", keywords: "archived old" },
  { cat: "pages", title: "Messages", href: "/messages", desc: "Conversations with Live Agents and businesses", icon: "messages-square", keywords: "inbox chat" },
  { cat: "pages", title: "Agent Desk", href: "/agent-desk", desc: "Your Live Agent profile, offers and phone", icon: "headphones", keywords: "live agent work", when: "liveAgent" },
  { cat: "pages", title: "Earnings and payouts", href: "/agent-desk/earnings", desc: "Stripe payouts, holds and what's been paid", icon: "wallet", keywords: "money bank stripe pay", when: "liveAgent" },
  { cat: "pages", title: "Backlog", href: "/backlog", desc: "Developer requests", icon: "list-todo", keywords: "dev requests" },
  { cat: "pages", title: "Developer", href: "/developer", desc: "MCP connector and API keys", icon: "plug", keywords: "api mcp claude connector keys webhooks" },
  { cat: "pages", title: "Orders", href: "/orders", desc: "Receipts for everything you bought", icon: "receipt", keywords: "purchases receipt invoice" },
  { cat: "pages", title: "Store and numbers", href: "/numbers", desc: "Get the perfect phone number", icon: "hash", keywords: "buy number phone number area code" },

  // Calls
  { cat: "calls", title: "Calls", href: "/calls", desc: "Every call in and out, with recordings", icon: "phone-incoming", keywords: "call log history inbound outbound voicemail" },
  { cat: "calls", title: "Dial pad", href: "/calls?tab=phone", desc: "Call from your browser", icon: "phone", keywords: "call dial outbound phone" },
  { cat: "calls", title: "Callbacks", href: "/calls?tab=callbacks", desc: "People waiting for a call back", icon: "phone-forwarded" },
  { cat: "calls", title: "Call rules", href: "/calls?tab=rules", desc: "Who rings through, who's screened or blocked", icon: "list-filter", keywords: "block vip allow list screening" },
  { cat: "calls", title: "Assistant", href: "/calls?tab=assistant", desc: "Your AI assistant's name, voice and greeting", icon: "bot", keywords: "ai receptionist voice greeting" },
  { cat: "calls", title: "Directory", href: "/calls?tab=directory", desc: "People and departments callers can ask for", icon: "book-user", keywords: "transfer extension" },
  { cat: "calls", title: "Mirror", href: "/calls?tab=mirror", desc: "Silent AI copilot on live calls", icon: "scan-eye", keywords: "copilot live" },
  { cat: "calls", title: "Fraud protection", href: "/calls?tab=protection", desc: "Code word, family and scam alerts", icon: "shield-check", keywords: "scam fraud code word family protect" },
  { cat: "calls", title: "Phones", href: "/calls/phones", desc: "Desk phones and apps on your line", icon: "smartphone", keywords: "grandstream desk phone sip device" },
  { cat: "calls", title: "Call Tree", href: "/call-tree", desc: "Greetings, menus, hours and extensions", icon: "workflow", keywords: "ivr menu hours extensions" },
  { cat: "calls", title: "Recording Studio", href: "/studio", desc: "Greetings and prompts in your voice or AI", icon: "audio-waveform", keywords: "greeting prompt music voice" },
  { cat: "calls", title: "Keep your number", href: "/calls/port", desc: "Move your number to Redial", icon: "arrow-right-left", keywords: "port transfer number" },
  { cat: "calls", title: "Set up Redial", href: "/setup", desc: "The step-by-step setup", icon: "wand-sparkles", keywords: "wizard setup start" },

  // Recordings
  { cat: "recordings", title: "Search recordings", href: "/search", desc: "Transcripts, summaries and action items", icon: "search", keywords: "transcript find" },
  { cat: "recordings", title: "Phone call recordings", href: "/library/source/calls", desc: "Recorded phone calls", icon: "phone" },
  { cat: "recordings", title: "Meetings", href: "/library/source/meetings", desc: "Recorded meetings", icon: "video" },
  { cat: "recordings", title: "Uploads", href: "/library/source/uploads", desc: "Audio you uploaded", icon: "upload" },
  { cat: "recordings", title: "Desktop recordings", href: "/library/source/desktop", desc: "Recorded on your computer", icon: "monitor" },

  // Settings
  { cat: "settings", title: "Profile", href: "/settings", desc: "Your name, photo and phone", icon: "user-round", keywords: "name photo avatar" },
  { cat: "settings", title: "Account", href: "/settings/account", desc: "Email, password and sign-in", icon: "key-round", keywords: "password email security" },
  { cat: "settings", title: "Notifications", href: "/settings/notifications", desc: "Email, text and push alerts", icon: "bell", keywords: "alerts email sms push" },
  { cat: "settings", title: "AI models", href: "/settings/ai", desc: "Which AI writes summaries and answers", icon: "cpu", keywords: "claude chatgpt grok kimi model keys" },
  { cat: "settings", title: "Plan and billing", href: "/billing", desc: "Your plan, minutes and payment", icon: "credit-card", keywords: "subscription plan upgrade minutes invoice" },
  { cat: "settings", title: "Team", href: "/team", desc: "Invite teammates to your workspace", icon: "users", keywords: "invite members workspace" },

  // Admin (shown to staff with the permission)
  { cat: "admin", title: "Admin dashboard", href: "/admin", desc: "Signups, revenue and activity", icon: "layout-dashboard", permission: "dashboard.view" },
  { cat: "admin", title: "Analytics", href: "/admin/analytics", desc: "Usage and growth", icon: "chart-column", permission: "analytics.view" },
  { cat: "admin", title: "Communications", href: "/admin/communications", desc: "Inbox, texts, calls, email and notifications", icon: "messages-square", permission: "comms.view", keywords: "inbox email sms text campaign" },
  { cat: "admin", title: "Admin calls", href: "/admin/communications?tab=calls", desc: "Admin phone and call log", icon: "phone", permission: "comms.view" },
  { cat: "admin", title: "Email", href: "/admin/communications?tab=email", desc: "Templates, campaigns and automations", icon: "mail", permission: "comms.view", keywords: "template campaign newsletter" },
  { cat: "admin", title: "Bookings", href: "/admin/bookings", desc: "Appointments and availability", icon: "calendar-days", permission: "crm.view" },
  { cat: "admin", title: "Contacts", href: "/admin/contacts", desc: "Everyone Qallus works with", icon: "contact", permission: "crm.view", keywords: "crm people customers" },
  { cat: "admin", title: "Leads", href: "/admin/leads", desc: "New inquiries", icon: "magnet", permission: "crm.view", keywords: "crm prospects" },
  { cat: "admin", title: "App waitlist", href: "/admin/waitlist", desc: "People waiting for the app", icon: "smartphone", permission: "comms.view" },
  { cat: "admin", title: "Pipeline", href: "/admin/pipeline", desc: "Opportunities by stage", icon: "square-kanban", permission: "crm.view", keywords: "deals sales forecast" },
  { cat: "admin", title: "Plans", href: "/admin/plans", desc: "Task plans and boards", icon: "list-checks", permission: "crm.view", keywords: "tasks projects" },
  { cat: "admin", title: "Workspace", href: "/admin/workspace", desc: "Team docs and notes", icon: "notebook-pen", permission: "crm.view", keywords: "docs notes wiki" },
  { cat: "admin", title: "Reports", href: "/admin/reports", desc: "Saved reports", icon: "file-chart-column", permission: "analytics.view" },
  { cat: "admin", title: "Clients", href: "/admin/clients", desc: "Companies you work with", icon: "building-2", permission: "crm.view", keywords: "companies accounts" },
  { cat: "admin", title: "Business Cards", href: "/admin/cards", desc: "Digital business cards", icon: "id-card", permission: "crm.view", keywords: "qr nfc card" },
  { cat: "admin", title: "Documents", href: "/admin/documents", desc: "Contracts, proposals and files", icon: "folder-open", permission: "crm.view", keywords: "files contract proposal" },
  { cat: "admin", title: "Automation", href: "/admin/automation", desc: "Automated workflows", icon: "workflow", permission: "comms.view" },
  { cat: "admin", title: "Redial (admin)", href: "/admin/redial", desc: "Lines, numbers and voice gateway", icon: "phone-call", permission: "users.view", keywords: "lines numbers gateway repair sip" },
  { cat: "admin", title: "Live Agents (admin)", href: "/admin/live-agents", desc: "Review, contact and manage Live Agents", icon: "headset", permission: "marketplace.view", keywords: "review approve block archive agents" },
  { cat: "admin", title: "Billing (admin)", href: "/admin/billing", desc: "Catalog, orders, promo codes and Stripe", icon: "credit-card", permission: "billing.view", keywords: "stripe catalog orders refunds promo coupon" },
  { cat: "admin", title: "AI", href: "/admin/ai", desc: "AI providers and usage", icon: "bot", permission: "ai.view" },
  { cat: "admin", title: "AI agents", href: "/admin/ai/agents", desc: "Agent accounts and keys", icon: "bot-message-square", permission: "staff.manage" },
  { cat: "admin", title: "User Management", href: "/admin/users", desc: "Customers, accounts and access", icon: "users", permission: "users.view", keywords: "customers accounts ban invite" },
  { cat: "admin", title: "Staff team", href: "/admin/team", desc: "Staff, roles and workload", icon: "users-round", permission: "crm.view", keywords: "staff roles" },
  { cat: "admin", title: "Admin settings", href: "/admin/settings", desc: "Integrations, security and audit log", icon: "settings", permission: "audit.view", keywords: "integrations keys twilio stripe resend security audit mfa" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s]/g, " ");

export function visibleEntries(o: { permissions: string[]; phoneLine: boolean; liveAgent: boolean }) {
  return DASH_ENTRIES.filter((e) =>
    (!e.permission || o.permissions.includes(e.permission))
    && (e.when !== "liveAgent" || o.liveAgent)
    && (e.when !== "phoneLine" || o.phoneLine));
}

// Best matches first: title start, then title words, then description and keywords.
export function searchDash<T extends { title: string; desc: string; keywords?: string; cat: string }>(entries: T[], q: string, cat: DashCategory, limit = 8): T[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = entries
    .filter((e) => cat === "all" || e.cat === cat)
    .map((e) => {
      const title = norm(e.title), rest = norm(`${e.desc} ${e.keywords ?? ""}`);
      let score = 0;
      for (const w of words) {
        if (title.startsWith(w)) score += 6;
        else if (title.split(/\s+/).some((t) => t.startsWith(w))) score += 4;
        else if (title.includes(w)) score += 3;
        else if (rest.split(/\s+/).some((t) => t.startsWith(w))) score += 2;
        else if (rest.includes(w)) score += 1;
        else return { e, score: 0 };
      }
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.e);
}
