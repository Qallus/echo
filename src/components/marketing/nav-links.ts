import { AgentIcon } from "./agent-icon";
import {
  AudioLines, AudioWaveform, Briefcase, Building2, CircleHelp, Code, FileAudio, House, PhoneCall, Mic, Phone, Search, ShieldAlert, ShieldCheck, Tag, UserRoundPlus, Waypoints, type LucideIcon,
} from "lucide-react";

// The public site's product navigation, shared by the desktop mega menu and
// the phone menu: Redial, phone service, Live Agents and Echo, each with its own column,
// worded so the columns don't read as duplicates. Five links each with a
// one-line description, so the columns line up.

type Icon = LucideIcon | React.ComponentType<{ className?: string }>;
export type NavLink = { href: string; title: string; desc: string; icon: Icon };
export type NavProduct = { name: string; tagline: string; icon: Icon; links: NavLink[] };

export const NAV_PRODUCTS: NavProduct[] = [
  {
    name: "Redial", tagline: "AI call screening", icon: AudioLines,
    links: [
      { href: "/#redial", title: "What Redial does", desc: "Screening, live controls, Mirror", icon: ShieldCheck },
      { href: "/protect", title: "Fraud protection", desc: "Stops likely scams before they ring", icon: ShieldAlert },
      { href: "/redial/business", title: "Redial for business", desc: "Leads, transfers, a line for the team", icon: Briefcase },
      { href: "/pricing", title: "Redial pricing", desc: "Free, Personal, Business and Team", icon: Tag },
      { href: "/faq#topic-redial", title: "Redial questions", desc: "Screening, live calls, sharing a line", icon: CircleHelp },
    ],
  },
  {
    name: "Phone service", tagline: "Home and business lines", icon: Phone,
    links: [
      { href: "/home-phone", title: "Home phone", desc: "Replace your landline", icon: House },
      { href: "/business-phone", title: "Business phone", desc: "Desk phones, extensions, transfers", icon: Building2 },
      { href: "/business-phone#phones", title: "Phones that work", desc: "Grandstream, Yealink, Poly and more", icon: PhoneCall },
      { href: "/pricing#phone-service", title: "Phone plans", desc: "Home Phone and Business Phone", icon: Tag },
      { href: "/recording-studio", title: "Recording Studio", desc: "Greetings, phone menus, AI voices", icon: AudioWaveform },
    ],
  },
  {
    name: "Live Agents", tagline: "Real people on your phones", icon: AgentIcon,
    links: [
      { href: "/live-agents", title: "Search Live Agents", desc: "By skill, language and availability", icon: Search },
      { href: "/live-agents/how-it-works", title: "How it works", desc: "AI answers first, then a person", icon: Waypoints },
      { href: "/live-agents/how-it-works#pricing", title: "Live Agent rates", desc: "Per minute, per shift or monthly", icon: Tag },
      { href: "/become-a-live-agent", title: "Become an agent", desc: "Answer calls from home, your hours", icon: UserRoundPlus },
      { href: "/faq#topic-live-agents", title: "Questions & answers", desc: "Booking, payment, getting listed", icon: CircleHelp },
    ],
  },
  {
    name: "Echo", tagline: "Recordings and transcripts", icon: Mic,
    links: [
      { href: "/#features", title: "What Echo captures", desc: "Recordings, transcripts, summaries", icon: FileAudio },
      { href: "/#how-echo", title: "From meeting to report", desc: "Record, transcribe, share", icon: Waypoints },
      { href: "/pricing?product=echo", title: "Echo plans", desc: "Free to start, monthly or annual", icon: Tag },
      { href: "/developers", title: "Echo for developers", desc: "API, keys and webhooks", icon: Code },
      { href: "/faq#topic-recording", title: "Echo questions", desc: "Recording, AI, workspaces", icon: CircleHelp },
    ],
  },
];

export const NAV_MORE = [
  { href: "/live-agents", label: "Live Agents" },
  { href: "/pricing", label: "Pricing" },
  { href: "/developers", label: "Developers" },
  { href: "/contact", label: "Contact" },
];
