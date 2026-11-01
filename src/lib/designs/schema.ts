// Summary designs: the branding applied to exported and shared summaries.
// Edited step by step in the Summary Builder, or by Claude through the MCP
// tools (src/lib/mcp/tools/designs.ts). normalizeDesign() makes any partial
// or untrusted input safe to render.

export type Align = "left" | "center" | "right";

export const BLOCKS = {
  overview: { label: "Overview", hint: "Two or three sentence recap" },
  sections: { label: "Template sections", hint: "The template's headings and bullets" },
  keyPoints: { label: "Key points", hint: "The most important points" },
  actionItems: { label: "Action items", hint: "Tasks grouped by owner" },
  highlights: { label: "Highlights", hint: "Timestamped moments" },
  mindMap: { label: "Mind map", hint: "Topic overview" },
  listen: { label: "Listen link", hint: "Button to open the recording" },
} as const;
export type BlockId = keyof typeof BLOCKS;
export const BLOCK_IDS = Object.keys(BLOCKS) as BlockId[];

export type SummaryDesign = {
  version: 1;
  logo: { url: string | null; height: number; align: Align };
  header: { title: string; subtitle: string; background: string; textColor: string };
  page: { background: string; content: string; text: string; accent: string; font: "sans" | "serif" };
  footer: { background: string; textColor: string; text: string; links: string; poweredBy: boolean };
  blocks: { id: BlockId; enabled: boolean }[];
};

export const MERGE_FIELDS = [
  { token: "{{recording_title}}", label: "Recording title" },
  { token: "{{date}}", label: "Date" },
  { token: "{{duration}}", label: "Duration" },
  { token: "{{template}}", label: "Template name" },
  { token: "{{workspace}}", label: "Workspace" },
  { token: "{{year}}", label: "Year" },
];

export const DEFAULT_DESIGN: SummaryDesign = {
  version: 1,
  logo: { url: null, height: 36, align: "left" },
  header: { title: "{{recording_title}}", subtitle: "{{date}} · {{duration}} · {{template}}", background: "#0a0a0a", textColor: "#ffffff" },
  page: { background: "#f4f4f5", content: "#ffffff", text: "#18181b", accent: "#0a0a0a", font: "sans" },
  footer: { background: "#0a0a0a", textColor: "#a1a1aa", text: "Prepared with Echo · © {{year}}", links: "", poweredBy: true },
  blocks: BLOCK_IDS.map((id) => ({ id, enabled: id !== "mindMap" })),
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim() : fallback);
const text = (v: unknown, fallback: string, max = 300) => (typeof v === "string" ? v.slice(0, max) : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
const align = (v: unknown, fallback: Align): Align => (v === "left" || v === "center" || v === "right" ? v : fallback);
// Only http(s) images: no javascript:, data: or other schemes.
const imageUrl = (v: unknown) => (typeof v === "string" && /^https?:\/\/[^\s"'<>]+$/i.test(v.trim()) ? v.trim().slice(0, 1000) : null);

type Partial2<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

export function normalizeDesign(input: unknown, base: SummaryDesign = DEFAULT_DESIGN): SummaryDesign {
  const d = (input && typeof input === "object" ? input : {}) as Partial2<SummaryDesign>;
  const blocksIn = Array.isArray(d.blocks) ? d.blocks : null;
  const blocks = blocksIn
    ? [
        ...blocksIn.filter((b): b is { id: BlockId; enabled: boolean } => !!b && BLOCK_IDS.includes((b as { id: BlockId }).id))
          .filter((b, i, all) => all.findIndex((x) => x.id === b.id) === i)
          .map((b) => ({ id: b.id, enabled: b.enabled !== false })),
        ...base.blocks.filter((b) => !blocksIn.some((x) => (x as { id?: string })?.id === b.id)).map((b) => ({ ...b, enabled: false })),
      ]
    : base.blocks;
  return {
    version: 1,
    logo: {
      url: d.logo && "url" in d.logo ? imageUrl(d.logo.url) : base.logo.url,
      height: num(d.logo?.height, base.logo.height, 16, 120),
      align: align(d.logo?.align, base.logo.align),
    },
    header: {
      title: text(d.header?.title, base.header.title, 200),
      subtitle: text(d.header?.subtitle, base.header.subtitle, 300),
      background: color(d.header?.background, base.header.background),
      textColor: color(d.header?.textColor, base.header.textColor),
    },
    page: {
      background: color(d.page?.background, base.page.background),
      content: color(d.page?.content, base.page.content),
      text: color(d.page?.text, base.page.text),
      accent: color(d.page?.accent, base.page.accent),
      font: d.page?.font === "serif" ? "serif" : d.page?.font === "sans" ? "sans" : base.page.font,
    },
    footer: {
      background: color(d.footer?.background, base.footer.background),
      textColor: color(d.footer?.textColor, base.footer.textColor),
      text: text(d.footer?.text, base.footer.text, 1000),
      links: text(d.footer?.links, base.footer.links, 500),
      poweredBy: typeof d.footer?.poweredBy === "boolean" ? d.footer.poweredBy : base.footer.poweredBy,
    },
    blocks,
  };
}

export type MergeValues = { recording_title: string; date: string; duration: string; template: string; workspace: string; year: string };

export const fill = (s: string, v: MergeValues) => s.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in v ? v[k as keyof MergeValues] : m));
