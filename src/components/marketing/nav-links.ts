import {
  AudioLines, Briefcase, Building2, CircleHelp, Code, FileAudio, Headset, House, Mic, Phone, ShieldCheck, Tag, Waypoints, type LucideIcon,
} from "lucide-react";

// The public site's product navigation, shared by the desktop mega menu and
// the phone menu: Redial, phone service and Echo, each with its own column,
// worded so the columns don't read as duplicates. Five links each with a
// one-line description, so the columns line up.

export type NavLink = { href: string; title: string; desc: string; icon: LucideIcon };
export type NavProduct = { name: string; tagline: string; icon: LucideIcon; links: NavLink[] };

export const NAV_PRODUCTS: NavProduct[] = [
  {
    name: "Redial", tagline: "AI call screening", icon: AudioLines,
    links: [
      { href: "/#redial", title: "What Redial does", desc: "Screening, live controls, Mirror", icon: ShieldCheck },
      { href: "/#how-redial", title: "How a call is handled", desc: "From the first ring to the summary", icon: Waypoints },
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
      { href: "/business-phone#phones", title: "Phones that work", desc: "Grandstream, Yealink, Poly and more", icon: Headset },
      { href: "/pricing#phone-service", title: "Phone plans", desc: "Home Phone and Business Phone", icon: Tag },
      { href: "/faq#topic-phones", title: "Phone questions", desc: "Porting, 911, outages, SIP", icon: CircleHelp },
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
  { href: "/pricing", label: "Pricing" },
  { href: "/developers", label: "Developers" },
  { href: "/contact", label: "Contact" },
];
