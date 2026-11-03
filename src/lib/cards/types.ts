// Digital business cards (ported from Channel Cast): shared types, defaults
// and the vCard builder. Client-safe.

export type CardStatus = "draft" | "published" | "unpublished" | "archived";
export type ThemeMode = "light" | "dark" | "both";
export type LinkType = "website" | "social" | "phone" | "email" | "sms" | "map" | "booking" | "payment" | "download" | "video" | "review" | "custom";
export type SectionType = "opener" | "profile_header" | "quick_actions" | "links" | "lead_capture" | "video" | "qr_code" | "nfc" | "slideshow" | "steps";
export type LeadStatus = "new" | "contacted" | "qualified" | "archived";
export type NfcStatus = "not_ordered" | "ordered" | "assigned" | "active";

export type StepItem = { id: string; title: string; description?: string };
export type Slide = { id: string; image_url: string; caption?: string };
export type CardLink = { id: string; label: string; url: string; link_type: LinkType; is_visible: boolean; open_in_new_tab: boolean };
export type CardSection = {
  id: string; section_type: SectionType; label: string; content: Record<string, unknown>; is_visible: boolean; margin_top: number; margin_bottom: number;
};
export type MediaSettings = {
  profile_shape?: "circle" | "rounded" | "square"; profile_outline?: boolean; profile_outline_color?: string; profile_link_url?: string;
  content_align?: "center" | "left"; use_background_image?: boolean;
  logo_height?: number; logo_width?: number; logo_link_url?: string; logo_align?: "left" | "center" | "right";
  logo_padding?: number; logo_margin_top?: number; logo_margin_bottom?: number;
};
export type QrSettings = { foreground?: string; display_size?: number };
export type LeadField = { key: "name" | "email" | "phone" | "company" | "message"; label: string; enabled: boolean; required: boolean };
export type LeadFormSettings = { enabled: boolean; title: string; description: string; button_label: string; submit_label: string; fields: LeadField[] };
export type AutomationAction = "notify_owner_email" | "notify_owner_sms" | "autoreply_email";
export type Automation = { action: AutomationAction; enabled: boolean; message?: string };
export type CardDesign = { sections: CardSection[]; qr_settings: QrSettings; lead_form_settings: LeadFormSettings; media_settings: MediaSettings; automations: Automation[] };

// What the public page and the preview need.
export type PublicCard = {
  slug: string; card_name: string | null; display_name: string; first_name: string | null; last_name: string | null; job_title: string | null;
  company_name: string | null; department: string | null; bio: string | null; primary_email: string | null; primary_phone: string | null;
  sms_phone: string | null; website_url: string | null; address: string | null; maps_url: string | null; intro_video_url: string | null;
  profile_photo_url: string | null; logo_url: string | null; background_image_url: string | null;
  accent_color: string; background_color: string; text_color: string; theme_mode: ThemeMode; links: CardLink[]; design: CardDesign;
};
export type Card = PublicCard & {
  id: string; owner_id: string | null; status: CardStatus; nfc_status: NfcStatus; published_at: string | null; created_at: string; updated_at: string;
};
export type CardTotals = { view: number; save: number; click: number; share: number; qr: number; nfc: number; lead: number; like: number; copy: number };
export type CardStats = Record<string, CardTotals>;
export type CardLead = {
  id: string; card_id: string; name: string; email: string | null; phone: string | null; company: string | null; message: string | null;
  contact_id: string | null; status: LeadStatus; created_at: string;
};
export type CardAnalytics = { days: number; totals: CardTotals; daily: { date: string; views: number; clicks: number }[]; topLinks: { label: string; count: number }[] };

export const EMPTY_TOTALS: CardTotals = { view: 0, save: 0, click: 0, share: 0, qr: 0, nfc: 0, lead: 0, like: 0, copy: 0 };
export const LINK_TYPES: LinkType[] = ["website", "social", "phone", "email", "sms", "map", "booking", "payment", "download", "video", "review", "custom"];
export const DEFAULT_LOGO_HEIGHT = 48;
export const DEFAULT_LOGO_MARGIN_BOTTOM = 12;
export const DEFAULT_QR_DISPLAY = 128;
export const COLOR_PRESETS = [
  { name: "Clean", bg: "#ffffff", accent: "#18181b", text: "#18181b" },
  { name: "Charcoal", bg: "#121212", accent: "#fafafa", text: "#f4f4f5" },
  { name: "Ocean", bg: "#0f172a", accent: "#38bdf8", text: "#e2e8f0" },
  { name: "Forest", bg: "#0b1408", accent: "#a3e635", text: "#f6faf0" },
  { name: "Ivory", bg: "#f5f7ef", accent: "#2f6b13", text: "#13201a" },
  { name: "Plum", bg: "#1e1024", accent: "#e879f9", text: "#faf5ff" },
  { name: "Sunset", bg: "#fff7ed", accent: "#ea580c", text: "#431407" },
];

export const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
export const cardPath = (slug: string) => `/card/${slug}`;
export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);
export const cardName = (c: Pick<PublicCard, "display_name" | "first_name" | "last_name" | "card_name">) =>
  c.display_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.card_name || "Untitled card";

export const DEFAULT_LEAD_FORM: LeadFormSettings = {
  enabled: true, title: "Send me your info", description: "Share your details and I'll follow up.", button_label: "Send me your info", submit_label: "Send info",
  fields: [
    { key: "name", label: "Name", enabled: true, required: true },
    { key: "email", label: "Email", enabled: true, required: true },
    { key: "phone", label: "Phone", enabled: true, required: false },
    { key: "company", label: "Company", enabled: false, required: false },
    { key: "message", label: "Message", enabled: true, required: false },
  ],
};

export function defaultSections(): CardSection[] {
  const base: [SectionType, string, boolean][] = [
    ["opener", "Opener / splash", false], ["profile_header", "Profile header", true], ["quick_actions", "Quick actions", true],
    ["slideshow", "Slideshow", false], ["links", "Links & socials", true], ["steps", "Steps / how it works", false],
    ["lead_capture", "Lead capture", true], ["video", "Intro video", false], ["qr_code", "QR code", true], ["nfc", "NFC tap to share", false],
  ];
  return base.map(([section_type, label, is_visible]) => ({ id: uid(), section_type, label, content: {}, is_visible, margin_top: 0, margin_bottom: 16 }));
}

// Fill in anything an older or partial design is missing.
export function normalizeDesign(d: Partial<CardDesign> | null | undefined): CardDesign {
  const sections = Array.isArray(d?.sections) && d.sections.length ? d.sections : defaultSections();
  const lf = d?.lead_form_settings;
  return {
    sections,
    qr_settings: d?.qr_settings ?? {},
    lead_form_settings: lf && Array.isArray(lf.fields) ? lf : DEFAULT_LEAD_FORM,
    media_settings: d?.media_settings ?? {},
    automations: Array.isArray(d?.automations) ? d.automations : [],
  };
}
export const normalizeLinks = (links: unknown): CardLink[] => (Array.isArray(links) ? links : []).map((l: Partial<CardLink>) => ({
  id: l.id || uid(), label: l.label ?? "", url: l.url ?? "", link_type: l.link_type ?? "custom", is_visible: l.is_visible !== false, open_in_new_tab: l.open_in_new_tab !== false,
}));

export function newCard(owner: { id: string | null; name?: string; email?: string }): Card {
  const now = new Date().toISOString();
  return {
    id: "", owner_id: owner.id, status: "draft", nfc_status: "not_ordered", published_at: null, created_at: now, updated_at: now,
    slug: "", card_name: owner.name ? `${owner.name}'s card` : "My business card", display_name: owner.name ?? "", first_name: "", last_name: "",
    job_title: "", company_name: "", department: "", bio: "", primary_email: owner.email ?? "", primary_phone: "", sms_phone: "", website_url: "",
    address: "", maps_url: "", intro_video_url: "", profile_photo_url: null, logo_url: null, background_image_url: null,
    accent_color: "#18181b", background_color: "#ffffff", text_color: "#18181b", theme_mode: "light", links: [], design: normalizeDesign(null),
  };
}

const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

// vCard 3.0 (iPhone and Android contacts).
export function toVCard(c: PublicCard, pageUrl: string) {
  const first = c.first_name || c.display_name.split(/\s+/)[0] || "";
  const last = c.last_name || c.display_name.split(/\s+/).slice(1).join(" ");
  return [
    "BEGIN:VCARD", "VERSION:3.0", `N:${esc(last)};${esc(first)};;;`, `FN:${esc(cardName(c))}`,
    c.company_name && `ORG:${esc(c.company_name)}${c.department ? `;${esc(c.department)}` : ""}`, c.job_title && `TITLE:${esc(c.job_title)}`,
    c.primary_phone && `TEL;TYPE=CELL,VOICE:${c.primary_phone.replace(/[^\d+]/g, "")}`,
    c.primary_email && `EMAIL;TYPE=INTERNET:${c.primary_email}`, c.website_url && `URL:${c.website_url}`,
    c.address && `ADR;TYPE=WORK:;;${esc(c.address)};;;;`, c.profile_photo_url && `PHOTO;VALUE=URI:${c.profile_photo_url}`,
    ...c.links.filter((l) => l.is_visible && l.url).map((l) => `URL;TYPE=${l.label.replace(/[^\w-]/g, "") || "other"}:${l.url}`),
    `NOTE:${esc([c.bio, pageUrl].filter(Boolean).join("\n"))}`, "END:VCARD",
  ].filter(Boolean).join("\r\n");
}
