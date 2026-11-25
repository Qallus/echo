import {
  Archive, AudioWaveform, Bell, Bot, Briefcase, CalendarDays, CalendarSync, Compass, Contact, CreditCard, FileText, Handshake, Headphones, Headset,
  IdCard, KanbanSquare, LayoutTemplate, ListChecks, Lock, Mail, MessageSquareText, MessagesSquare, Mic, Phone, PhoneForwarded, Plug, ArrowRightLeft,
  ScanEye, Search, ListOrdered, Plus, Settings, ShieldCheck, Smartphone, Sparkles, Target, Upload, UserCircle, UserPlus, Users, Workflow, ListFilter, BookUser, ListTodo,
  type LucideIcon,
} from "lucide-react";

// Every feature in the user dashboard, in the sidebar's groups: what it does
// and how you'd use it for personal life and for a business. The "All
// features" slide-out, Explore and Ask Echo all read this list, so they agree.

export type Feature = {
  group: string; title: string; href: string; icon: LucideIcon;
  what: string; personal: string; business: string;
  soon?: boolean; needsLine?: boolean;
  /** Workspace CRM feature: coming soon until its database update has run. */
  crm?: boolean; liveAgent?: boolean; keywords?: string;
};

export const FEATURE_GROUPS = ["Start", "Communication", "Contacts", "Record", "Schedule", "Manage", "Marketing", "File Manager", "Agents", "Build", "Account"] as const;

export const FEATURES: Feature[] = [
  // Start
  { group: "Start", title: "Home", href: "/home", icon: Compass, what: "Your starting page: setup steps, quick actions and your newest files.",
    personal: "Pick up where you left off and see new recordings.", business: "Get the team's phone line set up and see what came in today." },
  { group: "Start", title: "Ask Echo", href: "/ask", icon: Sparkles, keywords: "ai chat help question",
    what: "Chat with AI (Claude, ChatGPT, Grok or Kimi) about any recording, your whole library, or how to use Redial.",
    personal: "\"What did the doctor say about my dosage?\" or \"Where do I change my greeting?\"", business: "\"Draft a follow-up email from today's sales call\" or \"List the action items from this week's meetings.\"" },
  { group: "Start", title: "Search", href: "/search", icon: Search, keywords: "find transcript",
    what: "Search every transcript, summary and action item. Also in the top bar (press / or Ctrl+K).",
    personal: "Find the call where someone gave you an address.", business: "Find every call that mentioned a product or a customer." },

  // Communication
  { group: "Communication", title: "Dialpad and call log", href: "/calls?tab=phone", icon: Phone, needsLine: true, keywords: "call dial phone recents",
    what: "Call from your browser on your Redial number, and see every call in and out with recordings and transcripts.",
    personal: "Call from your laptop without giving out your cell number.", business: "Make and log business calls from one number the whole team shares." },
  { group: "Communication", title: "Set up Redial", href: "/setup", icon: Phone, keywords: "wizard start number",
    what: "The step-by-step setup: pick or keep your number, choose where calls go, screening and your AI assistant.",
    personal: "A private number with spam screening in about 10 minutes.", business: "A business line with an AI receptionist, hours and a call tree." },
  { group: "Communication", title: "SMS", href: "/sms", icon: MessageSquareText, soon: true, keywords: "text message",
    what: "Two-way texts from your Redial number, with every conversation in one place.",
    personal: "Text from your private number instead of your cell.", business: "Text customers reminders and replies from the business number." },
  { group: "Communication", title: "Emails", href: "/email", icon: Mail, soon: true,
    what: "Send emails to your contacts with saved templates and a sent log.",
    personal: "Send the same note to family quickly.", business: "Follow up with leads and clients using templates." },
  { group: "Communication", title: "Notifications", href: "/notifications", icon: Bell, keywords: "alerts bell",
    what: "Everything Redial told you: recordings ready, calls, messages. Mark read, filter by kind.",
    personal: "See which recordings are ready to review.", business: "Catch missed calls and new messages in one list." },
  { group: "Communication", title: "Callbacks", href: "/calls?tab=callbacks", icon: PhoneForwarded, needsLine: true,
    what: "People waiting for a call back, with what they called about.",
    personal: "Never forget to call someone back.", business: "Work through the callback list between appointments." },
  { group: "Communication", title: "Call rules", href: "/calls?tab=rules", icon: ListFilter, needsLine: true, keywords: "block vip screen",
    what: "Who rings straight through, who is screened, and who is blocked.",
    personal: "Let family through and screen everyone else.", business: "VIP customers ring through; robocalls are blocked." },
  { group: "Communication", title: "Your AI assistant", href: "/calls?tab=assistant", icon: Bot, needsLine: true, keywords: "receptionist voice greeting",
    what: "Name your assistant and choose its voice and greeting. It answers, screens and takes messages.",
    personal: "An assistant that screens unknown callers for you.", business: "A receptionist that answers every call, 24/7." },
  { group: "Communication", title: "Directory", href: "/calls?tab=directory", icon: BookUser, needsLine: true,
    what: "People and departments callers can ask for by name.",
    personal: "Callers can ask for anyone in your household.", business: "\"Sales, please\" goes to the right person." },
  { group: "Communication", title: "Mirror (live copilot)", href: "/calls?tab=mirror", icon: ScanEye, needsLine: true,
    what: "A silent AI copilot on live calls: notes, suggestions and follow-up texts.",
    personal: "Get reminders of what to ask during an important call.", business: "Suggested answers and follow-ups while you talk to a customer." },
  { group: "Communication", title: "Fraud protection", href: "/calls?tab=protection", icon: ShieldCheck, needsLine: true, keywords: "scam code word family",
    what: "A family code word, scam alerts and trusted contacts.",
    personal: "Protect parents from scam calls.", business: "Stop fake vendor and payment scams." },
  { group: "Communication", title: "Call Tree", href: "/call-tree", icon: Workflow, keywords: "ivr menu hours extensions",
    what: "Greetings, menus, business hours, extensions and AI steps for where each call goes.",
    personal: "A simple greeting and voicemail.", business: "\"Press 1 for sales\", after-hours messages and routing." },
  { group: "Communication", title: "Library (Recording Studio)", href: "/studio?tab=library", icon: AudioWaveform,
    what: "Your greetings, prompts and voice files, ready to use in your call tree.",
    personal: "Keep a few greetings for different times.", business: "Holiday, after-hours and on-hold messages in one place." },
  { group: "Communication", title: "Desk phones and apps", href: "/calls/phones", icon: Smartphone, needsLine: true, keywords: "grandstream sip device",
    what: "Desk phones and apps on your line, set up by QR or auto-provisioning, with E911.",
    personal: "Ring a home desk phone too.", business: "Desk phones for the office on the same number." },
  { group: "Communication", title: "Phone number manager", href: "/calls/numbers", icon: ListOrdered, keywords: "numbers lines",
    what: "All your Redial numbers, where their calls go, and numbers you're moving to Redial.",
    personal: "See your private number and its screening.", business: "Every line the team uses in one list." },
  { group: "Communication", title: "Add another number", href: "/calls/numbers/new", icon: Plus, keywords: "buy number area code",
    what: "Pick another Redial number by area code, city or a word to spell.",
    personal: "A separate number for selling things online.", business: "A line for each location, team or campaign." },
  { group: "Communication", title: "Desk and mobile phones", href: "/phones", icon: Smartphone, keywords: "buy phone hardware shop",
    what: "Buy desk phones and mobiles that work with Redial out of the box.",
    personal: "A cordless home phone on your Redial number.", business: "Desk phones for the office, set up automatically." },
  { group: "Communication", title: "Keep your number", href: "/calls/port", icon: ArrowRightLeft, keywords: "port transfer",
    what: "Move your existing number to Redial.",
    personal: "Keep the number everyone already has.", business: "Keep the number on your cards and website." },

  // Contacts
  { group: "Contacts", title: "Contacts", href: "/contacts", icon: Contact, crm: true,
    what: "Everyone you talk to, with calls, texts, recordings and notes on each person.",
    personal: "Doctors, contractors and family in one place.", business: "Your customer list with every call attached." },
  { group: "Contacts", title: "Leads", href: "/leads", icon: UserPlus, crm: true,
    what: "People who might become customers, with a status and next step.",
    personal: "Track people you're getting quotes from.", business: "Follow up on every inquiry until it's won or lost." },
  { group: "Contacts", title: "Prospects", href: "/prospects", icon: Target, crm: true,
    what: "Find businesses to reach out to, check their numbers, and add them as leads.",
    personal: "Find local services to compare.", business: "Build a call list of businesses in your area." },
  { group: "Contacts", title: "Clients", href: "/clients", icon: Handshake, crm: true,
    what: "Your customers, with deals, calls and recordings together.",
    personal: "Keep track of who you work for.", business: "Everything about each customer on one page." },

  // Record
  { group: "Record", title: "New recording", href: "/home", icon: Mic, keywords: "record meeting call upload",
    what: "Record a meeting or a call in the browser, or upload audio. The red New recording button in the sidebar.",
    personal: "Record a doctor's visit or a family meeting.", business: "Record sales calls and team meetings; get transcripts and summaries." },
  { group: "Record", title: "Upload audio", href: "/home", icon: Upload,
    what: "Drop an audio file anywhere to transcribe and summarize it.",
    personal: "Transcribe a voice memo.", business: "Upload recordings from other tools." },

  // Schedule
  { group: "Schedule", title: "Calendar", href: "/calendar", icon: CalendarDays, keywords: "events bookings",
    what: "Appointments, events and deadlines, with Day, Week, Month and Year views. Dates said on calls can become events.",
    personal: "Appointments and reminders.", business: "Bookings and meetings for the team." },
  { group: "Schedule", title: "Calendar sync", href: "/settings/connections", icon: CalendarSync, keywords: "google",
    what: "Connect Google Calendar so events flow both ways.",
    personal: "See Redial events on your phone's calendar.", business: "Keep the team calendar in step with Google." },

  // Manage
  { group: "Manage", title: "Pipeline", href: "/pipeline", icon: KanbanSquare, crm: true,
    what: "Deals from first call to closed, on a board you drag across.",
    personal: "Track a big purchase or project.", business: "See every open deal and its value." },
  { group: "Manage", title: "Plans", href: "/plans", icon: ListChecks, crm: true,
    what: "Plans with checklists and due dates, shared with your team.",
    personal: "A moving or wedding checklist.", business: "Project plans and follow-up tasks from calls." },
  { group: "Manage", title: "Workspace docs", href: "/docs", icon: FileText, crm: true,
    what: "Shared notes and documents with comments.",
    personal: "Household notes in one place.", business: "Team procedures and call scripts." },

  // Marketing
  { group: "Marketing", title: "Digital Business Cards", href: "/cards", icon: IdCard, crm: true, keywords: "qr card",
    what: "A digital business card shared by link or QR; people who save it become leads.",
    personal: "Share your contact details in one tap.", business: "Every rep gets a card; new contacts flow into Leads." },

  // File Manager
  { group: "File Manager", title: "Recording Studio", href: "/studio?tab=studio", icon: AudioWaveform, keywords: "greeting voice ai",
    what: "Make greetings and prompts in your own voice or an AI voice.",
    personal: "A friendly voicemail greeting.", business: "Professional menus and on-hold messages." },
  { group: "File Manager", title: "Personal files", href: "/library/all", icon: Lock,
    what: "Your private recordings, with folders and tabs for All files, Unfiled, Archive, Trash and Shared with me. Tick several files to move, file, archive, export or delete them.",
    personal: "Keep private recordings to yourself.", business: "Your own drafts before you share them with the team." },
  { group: "File Manager", title: "Business files", href: "/library/all", icon: Briefcase,
    what: "Recordings shared with your team, with the same tabs, folders and bulk actions.",
    personal: "Share recordings with family members you invite.", business: "Every team call and meeting in one shared place." },
  { group: "File Manager", title: "Archive", href: "/library/archive", icon: Archive,
    what: "Files you want out of the way but not deleted. Still searchable; unarchive any time.",
    personal: "Old calls you might need one day.", business: "Closed projects and past customers." },
  { group: "File Manager", title: "Templates", href: "/templates", icon: LayoutTemplate,
    what: "Summary templates and branded designs for recordings.",
    personal: "A simple summary for appointments.", business: "Sales call, interview and meeting templates with your brand." },

  // Agents
  { group: "Agents", title: "Search Live Agents", href: "/agents", icon: Search, keywords: "hire receptionist person",
    what: "Browse vetted people who answer your calls when your AI hands off. Hear voices, compare skills and rates.",
    personal: "Someone to answer while you travel.", business: "Overflow and after-hours coverage by real people." },
  { group: "Agents", title: "My Live Agents", href: "/hiring", icon: Headset, keywords: "hiring offers booked",
    what: "The agents you hired, open offers and booked work.",
    personal: "See who's covering your line.", business: "Manage shifts, offers and past work." },
  { group: "Agents", title: "Messages", href: "/messages", icon: MessagesSquare,
    what: "Private conversations with Live Agents and businesses. Contact details stay hidden.",
    personal: "Talk to the agent you booked.", business: "Brief agents and send offers." },
  { group: "Agents", title: "Agent Desk", href: "/agent-desk", icon: Headphones, keywords: "become agent earn",
    what: "Work as a Live Agent: your profile, availability, offers and earnings. Or build a profile to become one.",
    personal: "Earn money answering calls from home.", business: "Your team members can work as agents too." },
  { group: "Agents", title: "AI Agents", href: "/agents/ai", icon: Bot,
    what: "AI that works your phones: your call assistant, Call Tree AI steps and Ask Echo, with more agents coming.",
    personal: "An assistant that screens and takes messages.", business: "AI that answers, routes and follows up." },

  // Build
  { group: "Build", title: "Developer", href: "/developer", icon: Plug, keywords: "mcp api claude connector",
    what: "Connect Claude (MCP) to your recordings and Redial, and see what connected apps did.",
    personal: "Ask Claude on your phone about your recordings.", business: "Automate work with Claude and your own tools." },
  { group: "Build", title: "Backlog", href: "/backlog", icon: ListTodo,
    what: "Build requests from you, Claude on your phone and Claude Code.",
    personal: "Ideas you want built.", business: "The team's feature requests in one list." },

  // Account
  { group: "Account", title: "My Profile", href: "/settings", icon: UserCircle,
    what: "Your name, photo, phone and details.", personal: "How you appear to others.", business: "How teammates and customers see you." },
  { group: "Account", title: "Settings", href: "/settings/account", icon: Settings, keywords: "password email notifications ai models",
    what: "Account, notifications, AI models and connected accounts.", personal: "Choose how you're notified.", business: "Pick the AI model and your own keys." },
  { group: "Account", title: "Team", href: "/team", icon: Users, keywords: "invite members",
    what: "Business workspaces and teammates. Invite people and set roles.", personal: "Invite family to a shared space.", business: "Invite your team and set who can do what." },
  { group: "Account", title: "Plan and billing", href: "/billing", icon: CreditCard, keywords: "subscription minutes invoice",
    what: "Your plan, minutes used and payments. Orders has your receipts.", personal: "See minutes used.", business: "Upgrade the team plan." },
];

export function visibleFeatures(who: { line: boolean; liveAgent: boolean; crmReady?: boolean }) {
  return FEATURES.filter((f) => (!f.needsLine || who.line) && (!(f.href === "/setup") || !who.line))
    .map((f) => (f.crm && !who.crmReady ? { ...f, soon: true } : f));
}
