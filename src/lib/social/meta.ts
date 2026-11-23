import "server-only";
import { secrets } from "@/lib/secrets";
import { siteOrigin } from "@/lib/site";

// Facebook Pages and Instagram (business accounts linked to a Page) through
// Facebook Login. Keys: Integrations -> Social media -> Meta. Page tokens
// that come from a long-lived user token don't expire.

export type MetaAccount = { provider: "facebook" | "instagram"; externalId: string; name: string; picture: string | null; token: string };

export async function metaKeys() {
  const k = await secrets("META_APP_ID", "META_APP_SECRET", "META_GRAPH_VERSION");
  if (!k.META_APP_ID || !k.META_APP_SECRET) return null;
  return { id: k.META_APP_ID, secret: k.META_APP_SECRET, version: /^v\d+\.\d+$/.test(k.META_GRAPH_VERSION ?? "") ? k.META_GRAPH_VERSION! : "v23.0" };
}
export const metaRedirect = async () => `${await siteOrigin()}/api/integrations/meta/callback`;
const SCOPES = ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "business_management", "instagram_basic", "instagram_content_publish"];

export async function metaAuthUrl(appId: string, version: string, state: string) {
  const u = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  u.search = new URLSearchParams({ client_id: appId, redirect_uri: await metaRedirect(), state, scope: SCOPES.join(","), response_type: "code" }).toString();
  return u.toString();
}

async function graph<T>(version: string, path: string, params: Record<string, string>, method: "GET" | "POST" = "GET"): Promise<T> {
  const u = new URL(`https://graph.facebook.com/${version}/${path}`);
  const body = new URLSearchParams(params);
  if (method === "GET") u.search = body.toString();
  const res = await fetch(u, { method, cache: "no-store", ...(method === "POST" ? { body, headers: { "content-type": "application/x-www-form-urlencoded" } } : {}) });
  const j = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } };
  if (!res.ok || j.error) {
    const m = j.error?.message ?? `HTTP ${res.status}`;
    throw new Error(j.error?.code === 190 ? "Facebook sign-in expired: reconnect Facebook." : `Meta: ${m}`);
  }
  return j;
}

// Code -> long-lived user token -> the Pages they manage (and linked Instagram accounts).
export async function metaAccounts(code: string): Promise<MetaAccount[]> {
  const k = await metaKeys();
  if (!k) throw new Error("Meta keys missing.");
  const short = await graph<{ access_token: string }>(k.version, "oauth/access_token", { client_id: k.id, client_secret: k.secret, redirect_uri: await metaRedirect(), code });
  const long = await graph<{ access_token: string }>(k.version, "oauth/access_token", { grant_type: "fb_exchange_token", client_id: k.id, client_secret: k.secret, fb_exchange_token: short.access_token });
  const pages = await graph<{ data?: { id: string; name: string; access_token: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id: string; username?: string; profile_picture_url?: string } }[] }>(
    k.version, "me/accounts", { fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}", limit: "50", access_token: long.access_token });
  const out: MetaAccount[] = [];
  for (const p of pages.data ?? []) {
    out.push({ provider: "facebook", externalId: p.id, name: p.name, picture: p.picture?.data?.url ?? null, token: p.access_token });
    const ig = p.instagram_business_account;
    if (ig) out.push({ provider: "instagram", externalId: ig.id, name: ig.username ? `@${ig.username}` : `${p.name} (Instagram)`, picture: ig.profile_picture_url ?? null, token: p.access_token });
  }
  return out;
}

export async function facebookPost(token: string, pageId: string, text: string, imageUrl: string | null, link: string | null) {
  const k = await metaKeys();
  const v = k?.version ?? "v23.0";
  const r = imageUrl
    ? await graph<{ id: string; post_id?: string }>(v, `${pageId}/photos`, { url: imageUrl, caption: text, access_token: token }, "POST")
    : await graph<{ id: string }>(v, `${pageId}/feed`, { message: text, ...(link ? { link } : {}), access_token: token }, "POST");
  const id: string = ("post_id" in r && typeof r.post_id === "string" ? r.post_id : null) ?? r.id;
  return { id, url: `https://www.facebook.com/${id}` };
}

// Instagram needs an image: create the media, then publish it.
export async function instagramPost(token: string, igId: string, text: string, imageUrl: string | null) {
  if (!imageUrl) throw new Error("Instagram posts need an image.");
  const k = await metaKeys();
  const v = k?.version ?? "v23.0";
  const media = await graph<{ id: string }>(v, `${igId}/media`, { image_url: imageUrl, caption: text, access_token: token }, "POST");
  const pub = await graph<{ id: string }>(v, `${igId}/media_publish`, { creation_id: media.id, access_token: token }, "POST");
  const link = await graph<{ permalink?: string }>(v, pub.id, { fields: "permalink", access_token: token }).catch(() => ({ permalink: undefined }));
  return { id: pub.id, url: link.permalink ?? "https://www.instagram.com/" };
}
