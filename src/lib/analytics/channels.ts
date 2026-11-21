// Which channel brought a visit: campaign tags first (utm_*), then the
// referring site, else direct. Shared by the browser tracker and the server.
// Spec: docs/ANALYTICS_PLAN.md section 4.

export type Channel = "search" | "ai" | "social" | "email" | "sms" | "ads" | "referral" | "direct" | "campaign" | "card" | "partner";
export const CHANNELS: Record<Channel, string> = {
  search: "Search", ai: "AI assistants", social: "Social", email: "Email", sms: "Texts", ads: "Ads",
  referral: "Other websites", direct: "Direct", campaign: "Other campaigns", card: "Business cards", partner: "Partners",
};
export const isChannel = (v: unknown): v is Channel => typeof v === "string" && v in CHANNELS;

// AI assistants that send visitors (host -> name).
export const AI_HOSTS: [RegExp, string][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, "ChatGPT"], [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/, "Gemini"], [/(^|\.)copilot\.microsoft\.com$/, "Copilot"],
  [/(^|\.)claude\.ai$/, "Claude"], [/(^|\.)grok\.com$/, "Grok"], [/(^|\.)meta\.ai$/, "Meta AI"], [/(^|\.)you\.com$/, "You.com"],
  [/(^|\.)phind\.com$/, "Phind"], [/(^|\.)deepseek\.com$/, "DeepSeek"], [/(^|\.)mistral\.ai$/, "Le Chat"],
];
const SEARCH = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yahoo\.com|ecosia\.org|search\.brave\.com|baidu\.com|yandex\.[a-z]+)$/;
const SOCIAL = /(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com|instagram\.com|linkedin\.com|lnkd\.in|t\.co|x\.com|twitter\.com|youtube\.com|youtu\.be|tiktok\.com|reddit\.com|pinterest\.com|nextdoor\.com|threads\.net|bsky\.app)$/;
const WEBMAIL = /(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com|mail\.aol\.com)$/;

export type Attribution = { channel: Channel; source: string | null; medium: string | null; campaign: string | null; referrer_host: string | null; landing: string };

const aiName = (host: string) => AI_HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
const clip = (s: string | null, n: number) => (s ? s.trim().slice(0, n) || null : null);

export function classify(url: URL, referrer: string, ownHost: string): Attribution {
  const q = url.searchParams;
  let host: string | null = null;
  try { host = referrer ? new URL(referrer).hostname.replace(/^www\./, "").toLowerCase() : null; } catch { host = null; }
  if (host && (host === ownHost.replace(/^www\./, "") || host.endsWith(".redial.si"))) host = null;
  const src = clip(q.get("utm_source"), 100)?.toLowerCase() ?? null;
  const med = clip(q.get("utm_medium"), 60)?.toLowerCase() ?? null;
  const camp = clip(q.get("utm_campaign"), 120);
  const base = { source: src, medium: med, campaign: camp, referrer_host: host, landing: url.pathname.slice(0, 300) };

  if (src || med || camp) {
    const ai = src ? aiName(src.replace(/^www\./, "")) : null;
    const channel: Channel = ai ? "ai"
      : med && /^(email|e-mail|newsletter)$/.test(med) ? "email"
      : med && /^(sms|text|texts|mms)$/.test(med) ? "sms"
      : med && /^(cpc|ppc|paid|paidsearch|paid_search|display|ads|paid_social|paidsocial|retargeting)$/.test(med) ? "ads"
      : med && /^(social|social_media|organic_social|post)$/.test(med) ? "social"
      : med && /^(card|business_card|nfc|qr)$/.test(med) ? "card"
      : med && /^(partner|affiliate|reseller|influencer)$/.test(med) ? "partner"
      : med === "referral" ? "referral"
      : med === "organic" || med === "search" ? "search"
      : "campaign";
    return { ...base, channel, source: ai ?? src };
  }
  if (!host) return { ...base, channel: "direct" };
  const ai = aiName(host);
  if (ai) return { ...base, channel: "ai", source: ai };
  if (SEARCH.test(host)) return { ...base, channel: "search", source: host.split(".").find((p) => p !== "search" && p !== "m") ?? host };
  if (SOCIAL.test(host)) return { ...base, channel: "social", source: host };
  if (WEBMAIL.test(host)) return { ...base, channel: "email", source: host };
  return { ...base, channel: "referral", source: host };
}

// Crawlers worth knowing about (AI assistants and search), by user agent.
export const CRAWLERS: [RegExp, string][] = [
  [/GPTBot/i, "GPTBot (OpenAI)"], [/OAI-SearchBot/i, "OAI-SearchBot (ChatGPT search)"], [/ChatGPT-User/i, "ChatGPT-User"],
  [/ClaudeBot|Claude-Web|anthropic-ai|Claude-User|Claude-SearchBot/i, "ClaudeBot (Anthropic)"], [/PerplexityBot|Perplexity-User/i, "PerplexityBot"],
  [/Google-Extended/i, "Google-Extended (Gemini)"], [/Applebot/i, "Applebot"], [/Bytespider/i, "Bytespider (TikTok)"],
  [/meta-externalagent|FacebookBot/i, "Meta AI"], [/CCBot/i, "Common Crawl"], [/Amazonbot/i, "Amazonbot"], [/DuckAssistBot/i, "DuckAssist"],
  [/Googlebot/i, "Googlebot"], [/bingbot/i, "Bingbot"],
];
export const crawlerName = (ua: string) => CRAWLERS.find(([re]) => re.test(ua))?.[1] ?? null;

// Anything that looks automated isn't counted as a visitor.
export const isBot = (ua: string) => !ua || /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch|go-http/i.test(ua);
