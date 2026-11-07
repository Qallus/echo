// Email template blocks: the document the builder edits, and the renderer
// that turns it into email-safe HTML (tables and inline styles only, so Gmail
// and Outlook keep the layout). Ported from Channel-Cast's lib/email/blocks.ts.

export type BlockType =
  | "header" | "columns" | "heading" | "text" | "button" | "image" | "divider" | "spacer" | "footer"
  | "buttons" | "card" | "list" | "quote" | "callout" | "badge" | "stats" | "details" | "faq" | "social" | "video" | "code" | "signature";
export type BlockItem = { label: string; value?: string; url?: string };
export type Align = "left" | "center" | "right";

export type EmailBlock = {
  id: string; type: BlockType; title?: string; text?: string; url?: string; alt?: string; linkUrl?: string; align?: Align;
  width?: number; height?: number; headingLevel?: "h1" | "h2" | "h3"; fontSize?: number; textColor?: string;
  backgroundColor?: string; buttonColor?: string; buttonTextColor?: string; dividerColor?: string;
  columns?: { blocks: EmailBlock[] }[]; padTop?: number; padBottom?: number; padX?: number;
  // Newer blocks: a list of rows (list, stats, details, FAQ, social), a
  // second label and link (card button, second button, role or caption), a
  // border or accent color, and numbered lists.
  items?: BlockItem[]; label?: string; secondaryUrl?: string; borderColor?: string; ordered?: boolean;
};
export type EmailSettings = { width: number; backgroundColor: string; contentColor: string; textColor: string; fontFamily: string };
export type EmailSchema = { version: 1; settings: EmailSettings; blocks: EmailBlock[] };

export const DEFAULT_SETTINGS: EmailSettings = {
  width: 600, backgroundColor: "#f4f4f5", contentColor: "#ffffff", textColor: "#18181b",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

export const BLOCKS: Record<BlockType, { label: string; hint: string }> = {
  header: { label: "Header", hint: "Logo or brand bar" }, heading: { label: "Heading", hint: "Title" }, text: { label: "Text", hint: "Paragraph" },
  button: { label: "Button", hint: "Link button" }, image: { label: "Image", hint: "Picture with optional link" },
  columns: { label: "Columns", hint: "2 or 3 columns" }, divider: { label: "Divider", hint: "Line" }, spacer: { label: "Spacer", hint: "Empty gap" },
  footer: { label: "Footer", hint: "Address and unsubscribe" },
  buttons: { label: "Button pair", hint: "Main and outline button" }, card: { label: "Card", hint: "Image, title, text, button" },
  list: { label: "List", hint: "Bullets or numbers" }, quote: { label: "Quote", hint: "Testimonial with name" },
  callout: { label: "Callout", hint: "Highlighted note" }, badge: { label: "Badge", hint: "Small label" },
  stats: { label: "Stats", hint: "Big numbers in a row" }, details: { label: "Details", hint: "Label and value rows" },
  faq: { label: "FAQ", hint: "Questions and answers" }, social: { label: "Social links", hint: "Profile links" },
  video: { label: "Video", hint: "Thumbnail that opens a video" }, code: { label: "Code", hint: "Promo or access code" },
  signature: { label: "Signature", hint: "Photo, name and contact" },
};
export const BLOCK_ORDER: BlockType[] = ["header", "heading", "text", "button", "image", "columns", "divider", "spacer", "footer",
  "buttons", "card", "list", "quote", "callout", "badge", "stats", "details", "faq", "social", "video", "code", "signature"];
// How the builder's palette groups them.
export const BLOCK_GROUPS: { label: string; types: BlockType[] }[] = [
  { label: "Layout", types: ["header", "columns", "divider", "spacer", "footer"] },
  { label: "Text", types: ["heading", "text", "list", "quote", "callout", "badge", "faq"] },
  { label: "Media", types: ["image", "video", "card"] },
  { label: "Actions", types: ["button", "buttons", "social", "code"] },
  { label: "Data", types: ["stats", "details", "signature"] },
];
// Callout looks, like shadcn's Alert variants.
export const CALLOUTS = {
  info: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", textColor: "#1e3a8a" },
  success: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", textColor: "#14532d" },
  warning: { backgroundColor: "#fffbeb", borderColor: "#fde68a", textColor: "#78350f" },
  danger: { backgroundColor: "#fef2f2", borderColor: "#fecaca", textColor: "#7f1d1d" },
  neutral: { backgroundColor: "#f4f4f5", borderColor: "#e4e4e7", textColor: "#18181b" },
} as const;

export const MERGE_FIELDS = [
  { token: "{{first_name}}", label: "First name" }, { token: "{{last_name}}", label: "Last name" }, { token: "{{full_name}}", label: "Full name" },
  { token: "{{email}}", label: "Email" }, { token: "{{phone}}", label: "Phone" }, { token: "{{title}}", label: "Job title" },
  { token: "{{company}}", label: "Company" }, { token: "{{owner}}", label: "Owner" }, { token: "{{deal}}", label: "Deal" },
  { token: "{{stage}}", label: "Stage" }, { token: "{{amount}}", label: "Amount" }, { token: "{{site_url}}", label: "Site URL" },
  { token: "{{org_name}}", label: "Your company" }, { token: "{{org_address}}", label: "Your address" },
  { token: "{{org_phone}}", label: "Your phone" }, { token: "{{org_website}}", label: "Your website" },
];

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Colors and links come from the editor; only allow safe shapes into the HTML.
const color = (c: string | undefined, fallback: string) => (c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : fallback);
const href = (u: string | undefined) => (u && (/^(https?:|mailto:|tel:)/i.test(u) || /^\{\{\w+\}\}$/.test(u)) ? u : "#");
const src = (u: string | undefined, origin: string) => (!u ? "" : u.startsWith("/") ? origin + u : /^https:/i.test(u) ? u : "");
const num = (n: number | undefined, d: number, max = 1200) => Math.max(0, Math.min(max, Math.round(Number(n ?? d) || 0)));

let seq = 0;
export const blockId = () => `blk_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function createBlock(type: BlockType): EmailBlock {
  const base: EmailBlock = { id: blockId(), type, align: "left", padTop: 0, padBottom: 24, padX: 32 };
  switch (type) {
    case "header": return { ...base, title: "ECHO", backgroundColor: "#18181b", padTop: 18, padBottom: 18 };
    case "heading": return { ...base, text: "Your heading", headingLevel: "h2", fontSize: 22, textColor: "#18181b", padTop: 24 };
    case "text": return { ...base, text: "Hi {{first_name}},\n\nWrite your message here.", fontSize: 16, textColor: "#3f3f46" };
    case "button": return { ...base, text: "Learn more", linkUrl: "https://echo.redial.si", buttonColor: "#18181b", buttonTextColor: "#ffffff" };
    case "image": return { ...base, url: "", alt: "", width: 536 };
    case "divider": return { ...base, dividerColor: "#e4e4e7", padBottom: 16 };
    case "spacer": return { ...base, height: 24, padBottom: 0 };
    case "columns": return { ...base, columns: [{ blocks: [createBlock("text")] }, { blocks: [createBlock("text")] }] };
    case "footer": return { ...base, text: "{{org_name}} · {{org_address}}", fontSize: 12, textColor: "#71717a", align: "center", padTop: 8 };
    case "buttons": return { ...base, text: "Get started", linkUrl: "https://echo.redial.si", label: "Learn more", secondaryUrl: "https://echo.redial.si", buttonColor: "#18181b", buttonTextColor: "#ffffff" };
    case "card": return { ...base, url: "", alt: "", title: "Card title", text: "A short description of what this is about.", label: "Read more", linkUrl: "https://echo.redial.si", borderColor: "#e4e4e7", buttonColor: "#18181b", buttonTextColor: "#ffffff" };
    case "list": return { ...base, items: [{ label: "First point" }, { label: "Second point" }, { label: "Third point" }], ordered: false, fontSize: 16, textColor: "#3f3f46" };
    case "quote": return { ...base, text: "Echo saves me an hour after every call.", title: "Customer name", label: "Role, Company", url: "", fontSize: 18, borderColor: "#18181b", textColor: "#18181b" };
    case "callout": return { ...base, title: "Heads up", text: "Something worth noticing.", fontSize: 14, ...CALLOUTS.info };
    case "badge": return { ...base, text: "New", backgroundColor: "#18181b", textColor: "#ffffff", padTop: 16, padBottom: 12 };
    case "stats": return { ...base, items: [{ label: "Calls", value: "128" }, { label: "Hours saved", value: "42" }, { label: "Follow-ups", value: "96" }], fontSize: 28, textColor: "#18181b", align: "center" };
    case "details": return { ...base, title: "", items: [{ label: "Plan", value: "Pro" }, { label: "Amount", value: "{{amount}}" }, { label: "Date", value: "Nov 6, 2026" }], borderColor: "#e4e4e7", textColor: "#18181b" };
    case "faq": return { ...base, items: [{ label: "How do I get started?", value: "Sign in and record your first call." }, { label: "Can I cancel anytime?", value: "Yes, from Billing in your account." }], textColor: "#18181b" };
    case "social": return { ...base, items: [{ label: "LinkedIn", url: "https://www.linkedin.com/" }, { label: "Instagram", url: "https://www.instagram.com/" }, { label: "YouTube", url: "https://www.youtube.com/" }], align: "center", textColor: "#18181b", borderColor: "#e4e4e7" };
    case "video": return { ...base, url: "", alt: "Video", linkUrl: "https://www.youtube.com/", text: "Watch the video", width: 536, textColor: "#18181b" };
    case "code": return { ...base, title: "Use this code at checkout", text: "WELCOME20", label: "", align: "center", borderColor: "#a1a1aa", backgroundColor: "#fafafa", textColor: "#18181b" };
    case "signature": return { ...base, url: "", title: "{{owner}}", label: "Account manager, {{org_name}}", text: "{{org_phone}} · {{org_website}}", textColor: "#18181b", padTop: 8 };
  }
}

export const defaultSchema = (): EmailSchema => ({
  version: 1, settings: { ...DEFAULT_SETTINGS },
  blocks: [createBlock("header"), createBlock("heading"), createBlock("text"), createBlock("button"), createBlock("footer")],
});

const pad = (b: EmailBlock) => `padding:${num(b.padTop, 0, 200)}px ${num(b.padX, 0, 200)}px ${num(b.padBottom, 0, 200)}px`;
const items = (b: EmailBlock) => (Array.isArray(b.items) ? b.items : []).slice(0, 20);
const align = (b: EmailBlock) => (b.align === "center" || b.align === "right" ? b.align : "left");

function renderBlock(b: EmailBlock, s: EmailSettings, origin: string): string {
  switch (b.type) {
    case "header":
      return `<tr><td style="background:${color(b.backgroundColor, "#18181b")};${pad(b)};text-align:${align(b)}">${
        src(b.url, origin) ? `<img src="${esc(src(b.url, origin))}" alt="${esc(b.alt)}" height="${num(b.height, 28, 200)}" style="height:${num(b.height, 28, 200)}px;border:0;vertical-align:middle" />` : ""}${
        b.title ? `<span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:3px;vertical-align:middle">${esc(b.title)}</span>` : ""}</td></tr>`;
    case "heading":
      return `<tr><td style="${pad(b)};text-align:${align(b)}"><div style="color:${color(b.textColor, s.textColor)};font-size:${num(b.fontSize, 22, 60)}px;font-weight:700;line-height:1.3">${esc(b.text)}</div></td></tr>`;
    case "text":
      return `<tr><td style="${pad(b)};text-align:${align(b)}"><div style="color:${color(b.textColor, s.textColor)};font-size:${num(b.fontSize, 16, 40)}px;line-height:1.6;white-space:pre-wrap">${esc(b.text)}</div></td></tr>`;
    case "button":
      return `<tr><td style="${pad(b)};text-align:${align(b)}"><table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table"><tr><td style="border-radius:8px;background:${color(b.buttonColor, "#18181b")}"><a href="${esc(href(b.linkUrl))}" style="display:inline-block;padding:11px 20px;color:${color(b.buttonTextColor, "#ffffff")};font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">${esc(b.text || "Learn more")}</a></td></tr></table></td></tr>`;
    case "image": {
      const u = src(b.url, origin);
      if (!u) return "";
      const img = `<img src="${esc(u)}" alt="${esc(b.alt)}" width="${num(b.width, 536)}" style="max-width:100%;width:${num(b.width, 536)}px;border:0;display:block${align(b) === "center" ? ";margin:0 auto" : ""}" />`;
      return `<tr><td style="${pad(b)};text-align:${align(b)}">${b.linkUrl ? `<a href="${esc(href(b.linkUrl))}">${img}</a>` : img}</td></tr>`;
    }
    case "divider":
      return `<tr><td style="${pad(b)}"><div style="border-top:1px solid ${color(b.dividerColor, "#e4e4e7")};font-size:0;line-height:0">&nbsp;</div></td></tr>`;
    case "spacer":
      return `<tr><td style="height:${num(b.height, 24, 300)}px;font-size:0;line-height:0">&nbsp;</td></tr>`;
    case "columns": {
      const cols = (b.columns ?? []).slice(0, 3);
      const w = cols.length ? Math.floor(100 / cols.length) : 100;
      return `<tr><td style="${pad(b)}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cols.map((c) =>
        `<td width="${w}%" valign="top" style="width:${w}%"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${c.blocks.map((cb) => renderBlock({ ...cb, padX: 8 }, s, origin)).join("")}</table></td>`).join("")}</tr></table></td></tr>`;
    }
    case "buttons": {
      const fill = color(b.buttonColor, "#18181b");
      const btn = (label: string | undefined, link: string | undefined, solid: boolean) =>
        `<td style="padding:0 6px 8px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;${solid ? `background:${fill}` : `border:1px solid ${fill}`}"><a href="${esc(href(link))}" style="display:inline-block;padding:${solid ? 11 : 10}px 20px;color:${solid ? color(b.buttonTextColor, "#ffffff") : fill};font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">${esc(label || "Learn more")}</a></td></tr></table></td>`;
      return `<tr><td style="${pad(b)};text-align:${align(b)}"><table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table"><tr>${btn(b.text, b.linkUrl, true)}${b.label ? btn(b.label, b.secondaryUrl, false) : ""}</tr></table></td></tr>`;
    }
    case "card": {
      const u = src(b.url, origin);
      const fg = color(b.textColor, s.textColor);
      return `<tr><td style="${pad(b)}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${color(b.borderColor, "#e4e4e7")};border-radius:10px;overflow:hidden;border-collapse:separate">${
        u ? `<tr><td><img src="${esc(u)}" alt="${esc(b.alt)}" width="100%" style="width:100%;display:block;border:0" /></td></tr>` : ""}<tr><td style="padding:20px;text-align:${align(b)}">${
        b.title ? `<div style="color:${fg};font-size:18px;font-weight:700;line-height:1.3">${esc(b.title)}</div>` : ""}${
        b.text ? `<div style="margin-top:6px;color:${fg};opacity:.8;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(b.text)}</div>` : ""}${
        b.label ? `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;margin-top:14px"><tr><td style="border-radius:8px;background:${color(b.buttonColor, "#18181b")}"><a href="${esc(href(b.linkUrl))}" style="display:inline-block;padding:9px 16px;color:${color(b.buttonTextColor, "#ffffff")};font-size:13px;font-weight:600;text-decoration:none;border-radius:8px">${esc(b.label)}</a></td></tr></table>` : ""}</td></tr></table></td></tr>`;
    }
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      return `<tr><td style="${pad(b)}"><${tag} style="margin:0;padding-left:22px;list-style-type:${b.ordered ? "decimal" : "disc"};color:${color(b.textColor, s.textColor)};font-size:${num(b.fontSize, 16, 40)}px;line-height:1.6">${
        items(b).map((i) => `<li style="margin:0 0 6px">${esc(i.label)}</li>`).join("")}</${tag}></td></tr>`;
    }
    case "quote": {
      const fg = color(b.textColor, s.textColor);
      const avatar = src(b.url, origin);
      return `<tr><td style="${pad(b)}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-left:4px solid ${color(b.borderColor, "#18181b")};padding:4px 0 4px 18px"><div style="color:${fg};font-size:${num(b.fontSize, 18, 40)}px;font-style:italic;line-height:1.5;white-space:pre-wrap">&ldquo;${esc(b.text)}&rdquo;</div>${
        b.title || b.label ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px"><tr>${avatar ? `<td style="padding-right:12px;vertical-align:middle"><img src="${esc(avatar)}" alt="" width="40" height="40" style="width:40px;height:40px;border-radius:50%;display:block;border:0" /></td>` : ""}<td style="vertical-align:middle">${
          b.title ? `<div style="color:${fg};font-size:14px;font-weight:700">${esc(b.title)}</div>` : ""}${b.label ? `<div style="color:#71717a;font-size:13px">${esc(b.label)}</div>` : ""}</td></tr></table>` : ""}</td></tr></table></td></tr>`;
    }
    case "callout": {
      const fg = color(b.textColor, "#1e3a8a");
      return `<tr><td style="${pad(b)}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td style="background:${color(b.backgroundColor, "#eff6ff")};border:1px solid ${color(b.borderColor, "#bfdbfe")};border-radius:10px;padding:16px 18px;text-align:${align(b)}">${
        b.title ? `<div style="color:${fg};font-size:15px;font-weight:700;margin-bottom:4px">${esc(b.title)}</div>` : ""}<div style="color:${fg};font-size:${num(b.fontSize, 14, 30)}px;line-height:1.6;white-space:pre-wrap">${esc(b.text)}</div></td></tr></table></td></tr>`;
    }
    case "badge":
      return `<tr><td style="${pad(b)};text-align:${align(b)}"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${color(b.backgroundColor, "#18181b")};color:${color(b.textColor, "#ffffff")};font-size:12px;font-weight:600;letter-spacing:.3px">${esc(b.text)}</span></td></tr>`;
    case "stats": {
      const list = items(b).slice(0, 4);
      const w = list.length ? Math.floor(100 / list.length) : 100;
      return `<tr><td style="${pad(b)}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${list.map((i) =>
        `<td width="${w}%" valign="top" style="width:${w}%;padding:8px 4px;text-align:${align(b)}"><div style="color:${color(b.textColor, s.textColor)};font-size:${num(b.fontSize, 28, 60)}px;font-weight:700;line-height:1.2">${esc(i.value)}</div><div style="color:#71717a;font-size:13px;margin-top:4px">${esc(i.label)}</div></td>`).join("")}</tr></table></td></tr>`;
    }
    case "details": {
      const fg = color(b.textColor, s.textColor);
      const line = color(b.borderColor, "#e4e4e7");
      return `<tr><td style="${pad(b)}">${b.title ? `<div style="color:${fg};font-size:15px;font-weight:700;margin-bottom:8px">${esc(b.title)}</div>` : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${line}">${items(b).map((i) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${line};color:#71717a;font-size:14px">${esc(i.label)}</td><td style="padding:10px 0;border-bottom:1px solid ${line};color:${fg};font-size:14px;font-weight:600;text-align:right">${esc(i.value)}</td></tr>`).join("")}</table></td></tr>`;
    }
    case "faq": {
      const fg = color(b.textColor, s.textColor);
      return `<tr><td style="${pad(b)}">${items(b).map((i, k) =>
        `<div style="${k ? "margin-top:16px;" : ""}color:${fg};font-size:15px;font-weight:700;line-height:1.4">${esc(i.label)}</div><div style="margin-top:4px;color:#52525b;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(i.value)}</div>`).join("")}</td></tr>`;
    }
    case "social":
      return `<tr><td style="${pad(b)};text-align:${align(b)}">${items(b).map((i) =>
        `<a href="${esc(href(i.url))}" style="display:inline-block;margin:0 4px 6px;padding:6px 12px;border:1px solid ${color(b.borderColor, "#e4e4e7")};border-radius:999px;color:${color(b.textColor, s.textColor)};font-size:13px;font-weight:600;text-decoration:none">${esc(i.label)}</a>`).join("")}</td></tr>`;
    case "video": {
      const u = src(b.url, origin);
      const w = num(b.width, 536);
      const thumb = u
        ? `<img src="${esc(u)}" alt="${esc(b.alt)}" width="${w}" style="max-width:100%;width:${w}px;border:0;display:block;border-radius:8px${align(b) === "center" ? ";margin:0 auto" : ""}" />`
        : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td style="height:${Math.round(w * 0.5)}px;background:#18181b;border-radius:8px;text-align:center;vertical-align:middle;color:#ffffff;font-size:40px">&#9654;</td></tr></table>`;
      return `<tr><td style="${pad(b)};text-align:${align(b)}"><a href="${esc(href(b.linkUrl))}" style="text-decoration:none">${thumb}</a>${
        b.text ? `<div style="margin-top:8px"><a href="${esc(href(b.linkUrl))}" style="color:${color(b.textColor, s.textColor)};font-size:14px;font-weight:600;text-decoration:none">&#9654; ${esc(b.text)}</a></div>` : ""}</td></tr>`;
    }
    case "code": {
      const fg = color(b.textColor, s.textColor);
      return `<tr><td style="${pad(b)};text-align:${align(b)}">${b.title ? `<div style="color:#71717a;font-size:13px;margin-bottom:8px">${esc(b.title)}</div>` : ""}<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;border-collapse:separate"><tr><td style="padding:12px 24px;border:2px dashed ${color(b.borderColor, "#a1a1aa")};border-radius:8px;background:${color(b.backgroundColor, "#fafafa")};color:${fg};font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;letter-spacing:3px">${esc(b.text)}</td></tr></table>${
        b.label ? `<div style="color:#71717a;font-size:12px;margin-top:8px">${esc(b.label)}</div>` : ""}</td></tr>`;
    }
    case "signature": {
      const fg = color(b.textColor, s.textColor);
      const photo = src(b.url, origin);
      return `<tr><td style="${pad(b)}"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${photo ? `<td style="padding-right:14px;vertical-align:top"><img src="${esc(photo)}" alt="" width="56" height="56" style="width:56px;height:56px;border-radius:50%;display:block;border:0" /></td>` : ""}<td style="vertical-align:top">${
        b.title ? `<div style="color:${fg};font-size:15px;font-weight:700">${esc(b.title)}</div>` : ""}${b.label ? `<div style="color:#71717a;font-size:13px">${esc(b.label)}</div>` : ""}${
        b.text ? `<div style="color:${fg};font-size:13px;margin-top:6px;white-space:pre-wrap">${esc(b.text)}</div>` : ""}</td></tr></table></td></tr>`;
    }
    case "footer":
      return `<tr><td style="${pad(b)};text-align:${align(b)}"><div style="color:${color(b.textColor, "#71717a")};font-size:${num(b.fontSize, 12, 24)}px;line-height:1.6;white-space:pre-wrap">${esc(b.text)}</div><div style="margin-top:6px;font-size:11px"><a href="{{unsubscribe_url}}" style="color:#71717a">Unsubscribe</a></div></td></tr>`;
    default:
      return "";
  }
}

// One block's table row, for the editor canvas (each block is clickable there).
export const blockHtml = (b: EmailBlock, settings: EmailSettings, origin = "https://echo.redial.si") =>
  renderBlock(b, { ...DEFAULT_SETTINGS, ...settings }, origin.replace(/\/$/, ""));

export function schemaToHtml(schema: EmailSchema, opts: { preheader?: string; origin?: string } = {}): string {
  const s = { ...DEFAULT_SETTINGS, ...schema.settings };
  const origin = (opts.origin || "https://echo.redial.si").replace(/\/$/, "");
  const font = /^[\w\s,'-]+$/.test(s.fontFamily) ? s.fontFamily : DEFAULT_SETTINGS.fontFamily;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:${color(s.backgroundColor, DEFAULT_SETTINGS.backgroundColor)}">${
    opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>` : ""}
<tr><td align="center" style="padding:24px 12px;font-family:${font}">
<table role="presentation" width="${num(s.width, 600, 800)}" cellpadding="0" cellspacing="0" style="max-width:${num(s.width, 600, 800)}px;width:100%;background:${color(s.contentColor, "#ffffff")};border:1px solid #e4e4e7;border-radius:12px;overflow:hidden">
${schema.blocks.map((b) => renderBlock(b, s, origin)).join("\n")}
</table></td></tr></table>`;
}

export function schemaToText(schema: EmailSchema): string {
  const walk = (blocks: EmailBlock[]): string[] => blocks.flatMap((b) =>
    b.type === "columns" ? (b.columns ?? []).flatMap((c) => walk(c.blocks))
      : b.type === "button" ? [`${b.text ?? ""}: ${b.linkUrl ?? ""}`]
        : b.type === "buttons" ? [`${b.text ?? ""}: ${b.linkUrl ?? ""}`, b.label ? `${b.label}: ${b.secondaryUrl ?? ""}` : ""]
        : b.type === "card" ? [b.title ?? "", b.text ?? "", b.label ? `${b.label}: ${b.linkUrl ?? ""}` : ""]
        : b.type === "list" ? [(b.items ?? []).map((i, k) => `${b.ordered ? `${k + 1}.` : "-"} ${i.label}`).join("\n")]
        : b.type === "quote" ? [`"${b.text ?? ""}"${b.title ? `\n- ${b.title}${b.label ? `, ${b.label}` : ""}` : ""}`]
        : b.type === "callout" || b.type === "code" ? [[b.title, b.text, b.type === "code" ? b.label : ""].filter(Boolean).join("\n")]
        : b.type === "stats" || b.type === "details" ? [(b.items ?? []).map((i) => `${i.label}: ${i.value ?? ""}`).join("\n")]
        : b.type === "faq" ? (b.items ?? []).map((i) => `${i.label}\n${i.value ?? ""}`)
        : b.type === "social" ? [(b.items ?? []).map((i) => `${i.label}: ${i.url ?? ""}`).join("\n")]
        : b.type === "video" ? [`${b.text || "Watch the video"}: ${b.linkUrl ?? ""}`]
        : b.type === "signature" ? [[b.title, b.label, b.text].filter(Boolean).join("\n")]
        : b.type === "footer" ? [b.text ?? "", "Unsubscribe: {{unsubscribe_url}}"]
          : b.text ? [b.text] : []);
  return walk(schema.blocks).filter(Boolean).join("\n\n").trim();
}

// Simple message (no template): paragraphs from plain text, same frame.
export function plainToSchema(body: string, footer = true): EmailSchema {
  const blocks = [{ ...createBlock("text"), text: body, padTop: 28 }, ...(footer ? [createBlock("footer")] : [])];
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, blocks };
}

// Merge fields. In HTML, values are escaped; missing values become blank
// (the unsubscribe link is filled in last, per recipient).
export function applyMerge(input: string, values: Record<string, string | null | undefined>, html = false): string {
  return input.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    const v = values[key];
    if (v == null || v === "") return key === "unsubscribe_url" ? whole : "";
    return html ? esc(v) : v;
  });
}

export function parseSchema(raw: unknown): EmailSchema | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<EmailSchema>;
  if (!Array.isArray(s.blocks)) return null;
  return { version: 1, settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) }, blocks: s.blocks.slice(0, 80) as EmailBlock[] };
}

// ---------------------------------------------------------------------------
// HTML templates: hand-written markup instead of blocks. Scripts and inline
// event handlers are removed (email clients drop them anyway). The preview
// text is added as a hidden line, and if the markup has no unsubscribe link
// a small footer with one is added, so every send can be unsubscribed from.
// ---------------------------------------------------------------------------
export type TemplateMode = "blocks" | "html";
export type TemplateContent = { mode: TemplateMode; schema: EmailSchema | null; html: string; preheader?: string | null };

const UNSUB_FOOTER = `<div style="padding:16px;text-align:center;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;color:#71717a">{{org_name}} · <a href="{{unsubscribe_url}}" style="color:#71717a">Unsubscribe</a></div>`;

export function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<(iframe|object|embed|form)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')
    .slice(0, 500000);
}

export function htmlTemplate(html: string, opts: { preheader?: string | null } = {}): string {
  let out = cleanHtml(html);
  if (!out.includes("{{unsubscribe_url}}")) out = /<\/body\s*>/i.test(out) ? out.replace(/<\/body\s*>/i, `${UNSUB_FOOTER}</body>`) : `${out}${UNSUB_FOOTER}`;
  if (opts.preheader) {
    const pre = `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>`;
    out = /<body[^>]*>/i.test(out) ? out.replace(/<body[^>]*>/i, (m) => m + pre) : pre + out;
  }
  return out;
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&middot;": "·" };
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(style|head|title)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<div style="display:none[^>]*>[\s\S]*?<\/div>/i, "")
    .replace(/<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url: string, label: string) => {
      const l = label.replace(/<[^>]+>/g, "").trim();
      return l && l !== url ? `${l} (${url})` : url;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
  return text.includes("{{unsubscribe_url}}") ? text : `${text}\n\nUnsubscribe: {{unsubscribe_url}}`;
}

// What gets sent for a template, in either mode (merge fields still in place).
export function renderTemplate(t: TemplateContent, origin?: string): { html: string; text: string } {
  if (t.mode === "html") {
    const html = htmlTemplate(t.html, { preheader: t.preheader });
    return { html, text: htmlToText(html) };
  }
  const schema = t.schema ?? defaultSchema();
  return { html: schemaToHtml(schema, { preheader: t.preheader ?? undefined, origin }), text: schemaToText(schema) };
}

// Blocks -> starting HTML when switching a template to HTML mode.
export const schemaToEditableHtml = (schema: EmailSchema, origin?: string) =>
  `<!doctype html>\n<html>\n<body style="margin:0">\n${schemaToHtml(schema, { origin })}\n</body>\n</html>\n`;

export const STATUSES = ["draft", "active", "archived"] as const;
export type TemplateStatus = (typeof STATUSES)[number];
export const CATEGORIES = ["general", "sales", "onboarding", "follow-up", "newsletter", "billing", "support"];
