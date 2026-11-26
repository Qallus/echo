import {
  AudioWaveform, Bot, CalendarDays, CalendarSync, Compass, Contact, FileText, Handshake, Headset, Home, IdCard, KanbanSquare,
  LayoutTemplate, ListChecks, Mail, MessageSquareText, Phone, Plug, Bell, Search, Settings, Sparkles, Target, UserCircle, UserPlus, Workflow,
  type LucideIcon,
} from "lucide-react";

// The user dashboard's navigation, in Jeremy's order. The sidebar and the phone
// bottom bar both read this, so they can't drift apart. `files` marks where the
// sidebar puts one item per workspace (Personal files, Business files).
// `soon`: the page exists but the feature is still being built.

export type NavItem = {
  key: string; href: string; label: string; icon: LucideIcon;
  exact?: boolean; soon?: boolean;
  /** Workspace CRM page: "soon" until its database update has run. */
  crm?: boolean;
  /** Its ?tab= is the page's default, so a bare link to the page counts too. */
  defaultTab?: boolean;
  /** Only with a Redial line (callsUnread !== null). */
  needsLine?: boolean;
  /** Only without a Redial line. */
  noLine?: boolean;
  /** Only for people with a Live Agent profile. */
  liveAgent?: boolean;
};
export type NavGroup = { id: string; label?: string; items: NavItem[]; files?: boolean };

export const NAV_TOP: NavItem[] = [
  { key: "home", href: "/home", label: "Home", icon: Home },
  { key: "ask", href: "/ask", label: "Ask Echo", icon: Sparkles },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "communication", label: "Communication", items: [
      { key: "dialpad", href: "/calls?tab=phone", label: "Dialpad", icon: Phone, needsLine: true, defaultTab: true },
      { key: "setup", href: "/setup", label: "Set up Redial", icon: Phone, noLine: true },
      { key: "call-tree", href: "/call-tree", label: "Call Tree", icon: Workflow },
      { key: "library", href: "/studio?tab=library", label: "Greetings", icon: AudioWaveform, defaultTab: true },
      { key: "sms", href: "/sms", label: "SMS", icon: MessageSquareText, crm: true },
      { key: "email", href: "/email", label: "Emails", icon: Mail, crm: true },
      { key: "notifications", href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    id: "contacts", label: "Contacts", items: [
      { key: "contacts", href: "/contacts", label: "Contacts", icon: Contact, crm: true },
      { key: "leads", href: "/leads", label: "Leads", icon: UserPlus, crm: true },
      { key: "prospects", href: "/prospects", label: "Prospects", icon: Target, crm: true },
      { key: "clients", href: "/clients", label: "Clients", icon: Handshake, crm: true },
    ],
  },
  // The New recording button sits here (between Contacts and Schedule).
  {
    id: "schedule", label: "Schedule", items: [
      { key: "calendar", href: "/calendar", label: "Calendar", icon: CalendarDays },
      { key: "sync", href: "/settings/connections", label: "Sync", icon: CalendarSync },
    ],
  },
  {
    id: "manage", label: "Manage", items: [
      { key: "pipeline", href: "/pipeline", label: "Pipeline", icon: KanbanSquare, crm: true },
      { key: "plans", href: "/plans", label: "Plans", icon: ListChecks, crm: true },
      { key: "docs", href: "/docs", label: "Workspace", icon: FileText, crm: true },
    ],
  },
  {
    id: "marketing", label: "Marketing", items: [
      { key: "cards", href: "/cards", label: "Digital Business Cards", icon: IdCard, crm: true },
    ],
  },
  {
    id: "files", label: "File Manager", files: true, items: [
      { key: "studio", href: "/studio?tab=studio", label: "Recording Studio", icon: AudioWaveform },
      // (one item per workspace goes here)
      { key: "templates", href: "/templates", label: "Templates", icon: LayoutTemplate },
    ],
  },
  {
    id: "agents", label: "Agents", items: [
      { key: "agents", href: "/agents", label: "Search Live Agents", icon: Search, exact: true },
      { key: "my-agents", href: "/agents/mine", label: "My Live Agents", icon: Headset },
      { key: "ai-agents", href: "/agents/ai", label: "AI Agents", icon: Bot },
    ],
  },
  {
    id: "build", label: "Build", items: [
      { key: "developer", href: "/developer", label: "Developer", icon: Plug },
    ],
  },
];

export const NAV_BOTTOM: NavItem[] = [
  { key: "explore", href: "/explore", label: "Explore", icon: Compass },
  { key: "profile", href: "/settings", label: "My Profile", icon: UserCircle, exact: true },
  { key: "settings", href: "/settings/account", label: "Settings", icon: Settings },
];

export const ALL_NAV: NavItem[] = [...NAV_TOP, ...NAV_GROUPS.flatMap((g) => g.items), ...NAV_BOTTOM];
export const navItem = (key: string) => ALL_NAV.find((i) => i.key === key);

/** Who sees an item. */
export function showItem(i: NavItem, who: { line: boolean; liveAgent: boolean }) {
  if (i.needsLine && !who.line) return false;
  if (i.noLine && who.line) return false;
  if (i.liveAgent && !who.liveAgent) return false;
  return true;
}

/** Active when the path (and, if the link has one, its ?tab=) matches. */
export function isActive(href: string, pathname: string, search: URLSearchParams | null, exact?: boolean, defaultTab?: boolean) {
  const [path, query] = href.split("?");
  const pathOk = exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  if (!pathOk) return false;
  if (!query || !search) return true;
  const want = new URLSearchParams(query);
  return [...want].every(([k, v]) => { const got = search.get(k); return got === null ? Boolean(defaultTab) : got === v; });
}

// Section tabs shown on top of related pages (Agents, Developer).
export const AGENT_TABS = (liveAgent: boolean) => [
  { href: "/agents", label: "Search Live Agents", exact: true },
  { href: "/agents/mine", label: "My Live Agents" },
  { href: "/hiring", label: "Hiring" },
  { href: "/messages", label: "Messages" },
  { href: "/agent-desk", label: liveAgent ? "Agent Desk" : "Become an agent", exact: true },
  ...(liveAgent ? [{ href: "/agent-desk/clients", label: "My clients" }] : []),
  { href: "/agents/ai", label: "AI Agents" },
];
export const DEVELOPER_TABS = [
  { href: "/developer", label: "Developer" },
  { href: "/backlog", label: "Backlog" },
];

