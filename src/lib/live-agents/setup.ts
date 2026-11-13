// The Live Agent profile builder at /agent-desk/setup: eight steps, each
// saved as you go. Shared by the pages, the step components and the actions.

export const AGENT_STEPS = [
  { n: 1, key: "basics", short: "Basics", title: "Let's start with the basics" },
  { n: 2, key: "photo", short: "Photo", title: "Add a profile photo" },
  { n: 3, key: "experience", short: "Experience", title: "Your experience" },
  { n: 4, key: "skills", short: "Skills", title: "Skills and languages" },
  { n: 5, key: "workspace", short: "Setup", title: "Your workspace and equipment" },
  { n: 6, key: "voice", short: "Voice", title: "Let businesses hear you" },
  { n: 7, key: "rates", short: "Rates", title: "Rates and availability" },
  { n: 8, key: "review", short: "Review", title: "Review and send" },
] as const;
export type AgentStepKey = (typeof AGENT_STEPS)[number]["key"];
export const agentStepAt = (n: number) => AGENT_STEPS.find((s) => s.n === n) ?? null;
export const LAST_AGENT_STEP = AGENT_STEPS.length;

export const TIME_ZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

export const US_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

export const COMMON_LANGUAGES = ["English", "Spanish", "French", "Mandarin", "Cantonese", "Vietnamese", "Tagalog", "Arabic", "Hindi", "Portuguese", "Korean", "Russian", "German", "Italian", "Japanese", "ASL"];

export const COMMON_INDUSTRIES = ["Dental", "Medical", "Wellness", "Legal", "Real estate", "Home services", "Trades", "Property management", "Restaurants", "Catering", "Retail", "Hospitality", "Technology", "B2B services", "Insurance", "Automotive", "Nonprofit", "Education"];

// Suggested lines for the three voice clips. Agents should use a made-up
// business and never say their own name, number or email.
export const CLIP_IDEAS = [
  { title: "Greeting", script: "Thank you for calling Desert Sun Dental, this is [first name]. How can I help you today?" },
  { title: "Warm transfer", script: "Thanks for holding. I have Dr. Lee's office on the line, and I've shared that you'd like to move your appointment. Connecting you now." },
  { title: "Your choice", script: "Try a greeting in another language, an after-hours line, or how you'd take an order." },
];

export const CLIP_MIN_S = 5;
export const CLIP_MAX_S = 30;
export const CLIP_MAX_BYTES = 5 * 1024 * 1024;
export const CLIP_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/webm", "audio/ogg"];

export const AGENT_STATUS: Record<string, { label: string; tone: "outline" | "secondary" | "success" | "destructive"; detail: string }> = {
  draft: { label: "Draft", tone: "outline", detail: "Only you can see it. Finish the steps and send it for review." },
  pending: { label: "In review", tone: "secondary", detail: "The Redial team is reviewing your profile, usually within one business day." },
  live: { label: "Live", tone: "success", detail: "Businesses can find and message you." },
  paused: { label: "Paused", tone: "outline", detail: "Hidden from businesses until you turn it back on." },
  suspended: { label: "Suspended", tone: "destructive", detail: "Your profile is hidden. Contact support@redial.si." },
};
