// Campaign tags (utm_*) on links Redial sends, so Admin -> Analytics can
// credit the visit, signup and sale to the email or text that started it.
// Only links to Redial's own site are tagged, and never twice.

const OWN = /^https:\/\/(www\.)?redial\.si(\/|$|\?|#)/i;

export const campaignSlug = (s: string) => s.toLowerCase().replace(/\{\{[^}]*\}\}/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "campaign";

export function tagUrl(url: string, p: { source: string; medium: string; campaign: string }): string {
  if (!OWN.test(url) || /[?&]utm_/.test(url)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", p.source);
    u.searchParams.set("utm_medium", p.medium);
    u.searchParams.set("utm_campaign", p.campaign);
    return u.toString();
  } catch {
    return url;
  }
}

// Every href in an email's HTML.
export const tagLinks = (html: string, p: { source: string; medium: string; campaign: string }) =>
  html.replace(/href=(["'])(https:\/\/[^"']+)\1/gi, (_m, q: string, url: string) => `href=${q}${tagUrl(url.replace(/&amp;/g, "&"), p).replace(/&/g, "&amp;")}${q}`);
