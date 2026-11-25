import {
  AlarmClock, AudioWaveform, Bell, BellRing, BookOpen, CalendarCheck, CalendarDays, ChartArea, ChartBar, ChartColumn, ChartPie, CloudSun, Compass, Files,
  Headset, LayoutGrid, Link2, Mail, MessageSquareText, MessagesSquare, Mic, Monitor, NotebookPen, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing,
  Radio, ScanEye, Search, ShieldAlert, Sparkles, WandSparkles, type LucideIcon,
} from "lucide-react";
import type { CardType, Size } from "./layout";

// Every card the dashboard can show: what it is, where it sits in "Add card",
// its starting size, and whether you can have more than one.

export const CATEGORIES = ["Stats", "Communication", "Schedule", "Files", "Tools", "Charts", "Info"] as const;
export type Category = (typeof CATEGORIES)[number];

export type CardMeta = { title: string; what: string; icon: LucideIcon; category: Category; size: Size; repeat?: boolean };

export const CARDS: Record<CardType, CardMeta> = {
  get_started: { title: "Get started", what: "Set up Redial, phones, numbers and the apps.", icon: WandSparkles, category: "Info", size: "xl" },
  setup_progress: { title: "Setup progress", what: "Your Redial setup steps and what's left.", icon: WandSparkles, category: "Info", size: "lg" },
  whats_new: { title: "What's new", what: "New features worth trying.", icon: Sparkles, category: "Info", size: "xl" },
  install_app: { title: "Desktop app", what: "Install Redial in its own window.", icon: Monitor, category: "Info", size: "sm" },

  search: { title: "Search", what: "Search pages, recordings and transcripts.", icon: Search, category: "Tools", size: "lg" },
  all_features: { title: "All features", what: "Every feature, one click away.", icon: LayoutGrid, category: "Tools", size: "xs" },
  clock: { title: "Date and time", what: "Today's date and the time.", icon: AlarmClock, category: "Tools", size: "sm", repeat: true },
  weather: { title: "Weather", what: "Weather where you are.", icon: CloudSun, category: "Tools", size: "sm", repeat: true },
  dialpad: { title: "Dialpad", what: "Call from your Redial number.", icon: Phone, category: "Communication", size: "md" },
  recorder: { title: "Recorder", what: "Record a meeting or a call, or upload audio.", icon: Mic, category: "Tools", size: "md" },
  notepad: { title: "Notepad", what: "Quick notes that save as you type.", icon: NotebookPen, category: "Tools", size: "md", repeat: true },
  ask_echo: { title: "Ask Echo", what: "Ask about your calls, meetings or Redial.", icon: Sparkles, category: "Tools", size: "lg" },
  quick_links: { title: "Quick links", what: "Your most used pages as buttons.", icon: Link2, category: "Tools", size: "md" },

  notifications: { title: "Notifications", what: "What Redial told you, live.", icon: BellRing, category: "Communication", size: "md" },
  next_up: { title: "Next up", what: "Your next to-do or appointment.", icon: CalendarCheck, category: "Schedule", size: "md" },
  live_call: { title: "Live call", what: "The transcript of a call happening now.", icon: Radio, category: "Communication", size: "md" },
  recent_calls: { title: "Recent calls", what: "Your latest calls in and out.", icon: PhoneIncoming, category: "Communication", size: "md" },
  recent_texts: { title: "Recent texts", what: "Your latest text conversations.", icon: MessageSquareText, category: "Communication", size: "md" },
  recent_files: { title: "Recent files", what: "Your newest recordings.", icon: Files, category: "Files", size: "xl" },
  my_agents: { title: "My Live Agents", what: "The people answering your calls.", icon: Headset, category: "Communication", size: "md" },

  mini_calendar: { title: "Calendar", what: "This month, with today's agenda.", icon: CalendarDays, category: "Schedule", size: "lg" },
  upcoming: { title: "Upcoming", what: "Your next appointments and deadlines.", icon: BookOpen, category: "Schedule", size: "md" },

  stat_calls: { title: "Calls", what: "Calls this month, in, out and missed.", icon: Phone, category: "Stats", size: "sm" },
  stat_outbound: { title: "Outbound", what: "Calls you made this month.", icon: PhoneOutgoing, category: "Stats", size: "xs" },
  stat_inbound: { title: "Inbound", what: "Calls you got this month.", icon: PhoneIncoming, category: "Stats", size: "xs" },
  stat_missed: { title: "Missed", what: "Calls you missed this month.", icon: PhoneMissed, category: "Stats", size: "xs" },
  stat_monitored: { title: "Monitored", what: "Calls your AI assistant screened.", icon: ScanEye, category: "Stats", size: "xs" },
  stat_recordings: { title: "Recordings", what: "Recordings this month and minutes.", icon: AudioWaveform, category: "Stats", size: "xs" },
  stat_sms: { title: "SMS", what: "Texts sent and received, and texts left.", icon: MessageSquareText, category: "Stats", size: "sm" },
  stat_bookings: { title: "Bookings", what: "Appointments this month.", icon: CalendarCheck, category: "Stats", size: "xs" },
  stat_calendar: { title: "Calendar", what: "Events this week.", icon: CalendarDays, category: "Stats", size: "xs" },
  stat_notifications: { title: "Notifications", what: "Unread notifications.", icon: Bell, category: "Stats", size: "xs" },
  stat_messages: { title: "Messages", what: "Unread Live Agent messages.", icon: MessagesSquare, category: "Stats", size: "xs" },
  stat_alerts: { title: "Alerts", what: "Likely scam calls stopped this month.", icon: ShieldAlert, category: "Stats", size: "xs" },
  stat_emails: { title: "Emails", what: "Emails sent this month.", icon: Mail, category: "Stats", size: "xs" },
  stat_files: { title: "Files", what: "Files, archived and in Trash.", icon: Files, category: "Stats", size: "sm" },

  chart_calls: { title: "Calls by day", what: "Calls in and out over 30 days.", icon: ChartArea, category: "Charts", size: "lg", repeat: true },
  chart_texts: { title: "Texts by day", what: "Texts sent and received over 30 days.", icon: ChartColumn, category: "Charts", size: "lg", repeat: true },
  chart_recordings: { title: "Recordings by week", what: "Recordings over 12 weeks.", icon: ChartBar, category: "Charts", size: "lg", repeat: true },
  chart_outcomes: { title: "Call outcomes", what: "How this month's calls ended.", icon: ChartPie, category: "Charts", size: "md", repeat: true },
};

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  Stats: ChartColumn, Communication: Phone, Schedule: CalendarDays, Files, Tools: Compass, Charts: ChartArea, Info: Sparkles,
};
