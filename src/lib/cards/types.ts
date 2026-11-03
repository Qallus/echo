// Digital business cards: shared types and the vCard builder (client-safe).

export type CardLink = { label: string; url: string };
export type PublicCard = {
  slug: string; full_name: string; title: string | null; company: string | null; bio: string | null; email: string | null; phone: string | null;
  website: string | null; address: string | null; photo_url: string | null; logo_url: string | null; accent: string; theme: "light" | "dark";
  links: CardLink[]; lead_capture: boolean;
};
export type Card = PublicCard & { id: string; owner_id: string | null; active: boolean; created_at: string; updated_at: string };
export type CardStats = Record<string, { view: number; save: number; click: number; share: number; qr: number; nfc: number; lead: number }>;
export type CardLead = { id: string; card_id: string; name: string; email: string | null; phone: string | null; company: string | null; message: string | null; contact_id: string | null; created_at: string };

export const EMPTY_STATS = { view: 0, save: 0, click: 0, share: 0, qr: 0, nfc: 0, lead: 0 };
export const cardPath = (slug: string) => `/card/${slug}`;
export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);

const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

// vCard 3.0 (works with iPhone and Android contacts).
export function toVCard(c: PublicCard, pageUrl: string) {
  const [first, ...rest] = c.full_name.trim().split(/\s+/);
  const lines = [
    "BEGIN:VCARD", "VERSION:3.0",
    `N:${esc(rest.join(" "))};${esc(first ?? "")};;;`, `FN:${esc(c.full_name)}`,
    c.company && `ORG:${esc(c.company)}`, c.title && `TITLE:${esc(c.title)}`,
    c.phone && `TEL;TYPE=CELL,VOICE:${c.phone.replace(/[^\d+]/g, "")}`,
    c.email && `EMAIL;TYPE=INTERNET:${c.email}`,
    c.website && `URL:${c.website}`,
    c.address && `ADR;TYPE=WORK:;;${esc(c.address)};;;;`,
    c.photo_url && `PHOTO;VALUE=URI:${c.photo_url}`,
    ...c.links.map((l) => `URL;TYPE=${esc(l.label).replace(/[^\w-]/g, "") || "other"}:${l.url}`),
    `NOTE:${esc([c.bio, pageUrl].filter(Boolean).join("\n"))}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\r\n");
}
