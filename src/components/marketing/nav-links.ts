import {
  AudioLines, CircleHelp, FileAudio, Mic, ShieldCheck, Tag, Waypoints, type LucideIcon,
} from "lucide-react";

// The public site's product navigation, shared by the desktop mega menu and
// the phone menu. Each product has the same four kinds of link, worded so the
// two columns don't read as duplicates.

export type NavLink = { href: string; title: string; desc: string; icon: LucideIcon };
export type NavProduct = { name: string; tagline: string; icon: LucideIcon; links: NavLink[] };

export const NAV_PRODUCTS: NavProduct[] = [
  {
    name: "Redial", tagline: "AI call screening", icon: AudioLines,
    links: [
      { href: "/#redial", title: "What Redial does", desc: "Screening, live controls, Mirror", icon: ShieldCheck },
      { href: "/#how-redial", title: "How a call is handled", desc: "From the first ring to the summary", icon: Waypoints },
      { href: "/pricing", title: "Redial pricing", desc: "Free, Personal, Business and Team", icon: Tag },
      { href: "/faq#topic-redial", title: "Redial questions", desc: "Screening, live calls, sharing a line", icon: CircleHelp },
    ],
  },
  {
    name: "Echo", tagline: "Recordings and transcripts", icon: Mic,
    links: [
      { href: "/#features", title: "What Echo captures", desc: "Recordings, transcripts, summaries", icon: FileAudio },
      { href: "/#how-echo", title: "From meeting to report", desc: "Record, transcribe, share", icon: Waypoints },
      { href: "/pricing?product=echo", title: "Echo plans", desc: "Free to start, monthly or annual", icon: Tag },
      { href: "/faq#topic-recording", title: "Echo questions", desc: "Recording, AI, workspaces", icon: CircleHelp },
    ],
  },
];

export const NAV_MORE = [
  { href: "/pricing", label: "Pricing" },
  { href: "/developers", label: "Developers" },
  { href: "/contact", label: "Contact" },
];
