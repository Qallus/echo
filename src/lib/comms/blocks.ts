// Email template blocks: the document the builder edits, and the renderer
// that turns it into email-safe HTML (tables and inline styles only, so Gmail
// and Outlook keep the layout). Ported from Channel-Cast's lib/email/blocks.ts.

export type BlockType = "header" | "columns" | "heading" | "text" | "button" | "image" | "divider" | "spacer" | "footer";
export type Align = "left" | "center" | "right";

export type EmailBlock = {
  id: string; type: BlockType; title?: string; text?: string; url?: string; alt?: string; linkUrl?: string; align?: Align;
  width?: number; height?: number; headingLevel?: "h1" | "h2" | "h3"; fontSize?: number; textColor?: string;
  backgroundColor?: string; buttonColor?: string; buttonTextColor?: string; dividerColor?: string;
  columns?: { blocks: EmailBlock[] }[]; padTop?: number; padBottom?: number; padX?: number;
};
export type EmailSettings = { width: number; backgroundColor: string; contentColor: string; textColor: string; fontFamily: string };
export type EmailSchema = { version: 1; settings: EmailSettings; blocks: EmailBlock[] };

export const DEFAULT_SETTINGS: EmailSettings = {
  width: 600, backgroundColor: "#f4f4f5", contentColor: "#ffffff", textColor: "#18181b",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

export const BLOCKS: Record<BlockType, { label: string; hint: string }> = {
  header: { label: "Header", hint: "Brand bar" }, heading: { label: "Heading", hint: "Title" }, text: { label: "Text", hint: "Paragraph" },
  button: { label: "Button", hint: "Link button" }, image: { label: "Image", hint: "Picture with optional link" },
  columns: { label: "Columns", hint: "Two columns" }, divider: { label: "Divider", hint: "Line" }, spacer: { label: "Spacer", hint: "Gap" },
  footer: { label: "Footer", hint: "Address and unsubscribe" },
};
export const BLOCK_ORDER: BlockType[] = ["header", "heading", "text", "button", "image", "columns", "divider", "spacer", "footer"];

export const MERGE_FIELDS = [
  { token: "{{first_name}}", label: "First name" }, { token: "{{last_name}}", label: "Last name" }, { token: "{{full_name}}", label: "Full name" },
  { token: "{{email}}", label: "Email" }, { token: "{{phone}}", label: "Phone" }, { token: "{{title}}", label: "Job title" },
  { token: "{{company}}", label: "Company" }, { token: "{{owner}}", label: "Owner" }, { token: "{{deal}}", label: "Deal" },
  { token: "{{stage}}", label: "Stage" }, { token: "{{amount}}", label: "Amount" }, { token: "{{site_url}}", label: "Site URL" },
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
    case "footer": return { ...base, text: "Qallus LLC · Arizona", fontSize: 12, textColor: "#71717a", align: "center", padTop: 8 };
  }
}

export const defaultSchema = (): EmailSchema => ({
  version: 1, settings: { ...DEFAULT_SETTINGS },
  blocks: [createBlock("header"), createBlock("heading"), createBlock("text"), createBlock("button"), createBlock("footer")],
});

const pad = (b: EmailBlock) => `padding:${num(b.padTop, 0, 200)}px ${num(b.padX, 0, 200)}px ${num(b.padBottom, 0, 200)}px`;
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
    case "footer":
      return `<tr><td style="${pad(b)};text-align:${align(b)}"><div style="color:${color(b.textColor, "#71717a")};font-size:${num(b.fontSize, 12, 24)}px;line-height:1.6;white-space:pre-wrap">${esc(b.text)}</div><div style="margin-top:6px;font-size:11px"><a href="{{unsubscribe_url}}" style="color:#71717a">Unsubscribe</a></div></td></tr>`;
    default:
      return "";
  }
}

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
