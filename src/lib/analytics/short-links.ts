import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteOrigin } from "@/lib/site";
import { campaignSlug, tagUrl } from "./utm";

// Bulk texts: each link to redial.si becomes a short redial.si/l/<code> link,
// tagged for the campaign, so taps and the signups after them are counted
// (and the text stays short). Other sites' links are left alone.
export async function shortenTextLinks(db: SupabaseClient, body: string, campaign: string): Promise<string> {
  const origin = await siteOrigin();
  const slug = campaignSlug(campaign);
  const found = [...new Set(body.match(/https:\/\/(www\.)?redial\.si[^\s{}]*/gi) ?? [])].filter((u) => !u.includes("/l/"));
  let out = body;
  for (const url of found) {
    const target = tagUrl(url.replace(/[.,;:!?)]+$/, ""), { source: "redial", medium: "sms", campaign: slug });
    for (let i = 0; i < 3; i++) {
      const code = randomBytes(6).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 6);
      if (code.length < 6) continue;
      const { error } = await db.from("short_links").insert({ code, url: target, channel: "sms", campaign: slug });
      if (!error) { out = out.split(url.replace(/[.,;:!?)]+$/, "")).join(`${origin}/l/${code}`); break; }
      if (!/duplicate/i.test(error.message)) return body; // can't shorten: send as written
    }
  }
  return out;
}
