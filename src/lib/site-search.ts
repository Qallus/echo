import { FAQ_TOPICS, faqId } from "@/lib/faq";

// The public site's search: every page and section people look for, sorted
// into the categories in the header search (Residential, Business, Live
// Agents, AI Agents, Apps), plus every FAQ answer. Matching runs in the
// browser as you type; the AI answer (/api/site-ask) uses the same entries.

export const SEARCH_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "residential", label: "Residential" },
  { id: "business", label: "Business" },
  { id: "live-agents", label: "Live Agents" },
  { id: "ai-agents", label: "AI Agents" },
  { id: "apps", label: "Mobile & Desktop Apps" },
] as const;
export type SearchCategory = (typeof SEARCH_CATEGORIES)[number]["id"];
export type SearchEntry = { title: string; desc: string; href: string; cat: Exclude<SearchCategory, "all">; words?: string; faq?: boolean };

export const SITE_PAGES: SearchEntry[] = [
  // Residential
  { cat: "residential", title: "Home phone", desc: "Replace your landline with Redial home phone service", href: "/home-phone", words: "landline house family voip cordless" },
  { cat: "residential", title: "Keep your number", desc: "Bring your existing phone number to Redial", href: "/#keep-your-number", words: "port transfer number porting" },
  { cat: "residential", title: "Stop spam and robocalls", desc: "Redial screens unknown callers before your phone rings", href: "/#redial", words: "spam robocall scam block screen telemarketer" },
  { cat: "residential", title: "Personal plans", desc: "Free and Personal plans for you and your family", href: "/pricing", words: "price cost personal family free" },
  { cat: "residential", title: "Phones that work", desc: "Desk and cordless phones that work with Redial", href: "/compatibility", words: "handset cordless compatible device grandstream yealink" },
  { cat: "residential", title: "Record calls and meetings", desc: "Echo records, transcribes and summarizes your conversations", href: "/#features", words: "record transcript summary notes" },

  // Business
  { cat: "business", title: "Redial for business", desc: "Leads, transfers and a shared line for your team", href: "/redial/business", words: "company team small business receptionist" },
  { cat: "business", title: "Business phone", desc: "Desk phones, extensions, transfers and phone menus", href: "/business-phone", words: "office pbx extension ivr phone system" },
  { cat: "business", title: "Desk phones", desc: "Grandstream, Yealink, Poly and more, set up automatically", href: "/business-phone#phones", words: "handset hardware desk phone provisioning" },
  { cat: "business", title: "Phone plans", desc: "Home Phone and Business Phone plans", href: "/pricing#phone-service", words: "price cost lines minutes" },
  { cat: "business", title: "Business pricing", desc: "Business and Team plans, bolt-ons and minute packs", href: "/pricing#plans", words: "price cost team seats bolt-on" },
  { cat: "business", title: "Recording Studio", desc: "Professional greetings, phone menus and hold messages", href: "/recording-studio", words: "greeting voicemail ivr menu hold music voice over" },
  { cat: "business", title: "Use cases", desc: "How offices, clinics, trades and agencies use Redial", href: "/#use-cases", words: "examples industries" },
  { cat: "business", title: "Book a demo", desc: "Talk to us about Redial for your business", href: "/contact", words: "sales demo contact call us quote" },

  // Live Agents
  { cat: "live-agents", title: "Search Live Agents", desc: "Real people who answer your business calls, by skill, language and rate", href: "/live-agents", words: "find hire human receptionist answering service virtual assistant" },
  { cat: "live-agents", title: "How Live Agents work", desc: "Your AI answers first, then hands callers to a person", href: "/live-agents/how-it-works", words: "handoff transfer overflow after hours" },
  { cat: "live-agents", title: "Live Agent rates", desc: "Per minute, per shift or monthly, with the service fee shown", href: "/live-agents/how-it-works#pricing", words: "price cost fee hourly per minute retainer" },
  { cat: "live-agents", title: "Become a Live Agent", desc: "Answer calls from home, set your own hours and rate", href: "/become-a-live-agent", words: "job work from home earn money apply remote" },
  { cat: "live-agents", title: "Live Agents available now", desc: "People ready to take calls right now", href: "/live-agents?now=1", words: "available online today immediate" },
  { cat: "live-agents", title: "Bilingual Live Agents", desc: "Spanish and other languages", href: "/live-agents?language=Spanish", words: "spanish espanol bilingual language receptionist" },
  { cat: "live-agents", title: "Live Agent questions", desc: "Booking, payment, privacy and getting listed", href: "/faq#topic-live-agents", words: "faq help questions answers" },

  // AI Agents
  { cat: "ai-agents", title: "Your AI call assistant", desc: "Redial answers, screens, takes messages and transfers calls", href: "/#redial", words: "ai agent receptionist answering bot assistant" },
  { cat: "ai-agents", title: "How a call is handled", desc: "From the first ring to the summary", href: "/#how-redial", words: "call flow screening steps" },
  { cat: "ai-agents", title: "Live call controls", desc: "Listen in, whisper, take over or end any call", href: "/#controls", words: "insider audible gavel listen whisper barge take over" },
  { cat: "ai-agents", title: "AI voices", desc: "Name your assistant and pick its voice", href: "/recording-studio", words: "voice ara rex eve leo name tts" },
  { cat: "ai-agents", title: "Privacy and security", desc: "How Redial keeps calls and recordings private", href: "/#trust", words: "secure private data encryption" },
  { cat: "ai-agents", title: "AI with your recordings", desc: "Ask questions about any call or meeting", href: "/#how-echo", words: "chat claude gpt summary action items" },

  // Apps
  { cat: "apps", title: "Redial mobile app", desc: "iPhone and Android, with Echo built in", href: "/#app", words: "ios android iphone download app store google play" },
  { cat: "apps", title: "Desktop and web app", desc: "Echo in your browser on any computer", href: "/signup", words: "desktop web browser computer mac windows chrome" },
  { cat: "apps", title: "Pop-out recorder", desc: "An always-on-top recorder while you work in other windows", href: "/faq#topic-recording", words: "picture in picture desktop recorder" },
  { cat: "apps", title: "Developers", desc: "REST API, keys, webhooks and the MCP connector", href: "/developers", words: "api integration webhook mcp claude connector" },
  { cat: "apps", title: "Create an account", desc: "Start free on the web, then add the app", href: "/signup", words: "sign up register start" },
];

// FAQ topic -> search category.
const FAQ_CAT: Record<string, SearchEntry["cat"]> = {
  start: "apps", recording: "apps", ai: "ai-agents", organize: "apps", redial: "ai-agents", live: "ai-agents", sharing: "business",
  studio: "business", phones: "residential", billing: "business", privacy: "ai-agents", support: "apps", "live-agents": "live-agents",
};

export const SITE_FAQ: (SearchEntry & { answer: string })[] = FAQ_TOPICS.flatMap((t) => t.items.map((f) => ({
  cat: FAQ_CAT[t.id] ?? "apps", title: f.q, desc: f.a.length > 140 ? `${f.a.slice(0, 137).trimEnd()}…` : f.a, answer: f.a,
  href: `/faq#${faqId(f.q)}`, words: `${f.tags ?? ""} ${t.title}`, faq: true,
})));

export const SITE_INDEX: SearchEntry[] = [...SITE_PAGES, ...SITE_FAQ];

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ");

const STOP = new Set(["a", "an", "and", "are", "can", "do", "does", "for", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "the", "to", "what", "with", "you", "your"]);

// Scores each entry for the query: whole words beat prefixes, titles beat
// descriptions, and entries matching more of the words rank higher. At least
// half the meaningful words have to match.
export function searchSite(query: string, cat: SearchCategory = "all", limit = 8): SearchEntry[] {
  const words = norm(query).split(/\s+/).filter((w) => (w.length > 1 || /\d/.test(w)) && !STOP.has(w));
  const pool = SITE_INDEX.filter((e) => cat === "all" || e.cat === cat);
  if (!words.length) return [];
  const need = Math.ceil(words.length / 2);
  const scored = pool.map((e) => {
    const title = ` ${norm(e.title)} `, rest = ` ${norm(`${e.desc} ${e.words ?? ""}`)} `;
    let score = 0, hit = 0;
    for (const w of words) {
      const s = title.includes(` ${w} `) ? 6 : title.includes(` ${w}`) ? 4 : rest.includes(` ${w} `) ? 3 : rest.includes(` ${w}`) ? 2 : w.length > 3 && (title.includes(w) || rest.includes(w)) ? 1 : 0;
      if (s) { score += s; hit++; }
    }
    if (hit < need) return { e, score: 0 };
    return { e, score: score + hit * 4 + (e.faq ? 0 : 2) };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.e);
}

export const suggestionsFor = (cat: SearchCategory) => SITE_PAGES.filter((e) => cat === "all" || e.cat === cat);
