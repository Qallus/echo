import "server-only";
import { secrets } from "@/lib/secrets";
import { siteOrigin } from "@/lib/site";

// LinkedIn: sign in with LinkedIn (OpenID Connect) to post as Jeremy, and,
// once LinkedIn approves the Community Management API, as the Redial company
// page. Keys: Integrations -> Social media -> LinkedIn.
// Docs: Posts API (/rest/posts) with the versioned REST headers.

export type LinkedInAccount = { kind: "person" | "page"; externalId: string; name: string; picture: string | null };

export async function linkedinKeys() {
  const k = await secrets("LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_COMPANY_PAGES", "LINKEDIN_API_VERSION");
  if (!k.LINKEDIN_CLIENT_ID || !k.LINKEDIN_CLIENT_SECRET) return null;
  return {
    id: k.LINKEDIN_CLIENT_ID, secret: k.LINKEDIN_CLIENT_SECRET,
    pages: /^(y|yes|on|true|1)$/i.test(k.LINKEDIN_COMPANY_PAGES ?? ""),
    version: /^\d{6}$/.test(k.LINKEDIN_API_VERSION ?? "") ? k.LINKEDIN_API_VERSION! : "202610",
  };
}

export const linkedinRedirect = async () => `${await siteOrigin()}/api/integrations/linkedin/callback`;

export async function linkedinAuthUrl(clientId: string, pages: boolean, state: string) {
  const scope = ["openid", "profile", "w_member_social", ...(pages ? ["w_organization_social", "r_organization_social", "rw_organization_admin"] : [])].join(" ");
  const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
  u.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: await linkedinRedirect(), state, scope }).toString();
  return u.toString();
}

export async function linkedinToken(code: string) {
  const k = await linkedinKeys();
  if (!k) throw new Error("LinkedIn keys missing.");
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, cache: "no-store",
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: await linkedinRedirect(), client_id: k.id, client_secret: k.secret }),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; error_description?: string };
  if (!res.ok || !j.access_token) throw new Error(j.error_description ?? `LinkedIn token: HTTP ${res.status}`);
  return { accessToken: j.access_token, expiresIn: j.expires_in ?? 5_184_000, refreshToken: j.refresh_token ?? null, scopes: (j.scope ?? "").split(/[ ,]/).filter(Boolean) };
}

const headers = (token: string, version: string) => ({
  Authorization: `Bearer ${token}`, "LinkedIn-Version": version, "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json",
});

// The person, plus the company pages they administer (when allowed).
export async function linkedinAccounts(token: string, withPages: boolean, version: string): Promise<LinkedInAccount[]> {
  const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const u = (await me.json().catch(() => ({}))) as { sub?: string; name?: string; picture?: string };
  if (!me.ok || !u.sub) throw new Error("Couldn't read your LinkedIn profile.");
  const out: LinkedInAccount[] = [{ kind: "person", externalId: `urn:li:person:${u.sub}`, name: u.name ?? "LinkedIn profile", picture: u.picture ?? null }];
  if (!withPages) return out;
  const acl = await fetch("https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED", { headers: headers(token, version), cache: "no-store" });
  if (!acl.ok) return out; // Community Management API not approved yet: profile only.
  const a = (await acl.json().catch(() => ({}))) as { elements?: { organization?: string }[] };
  for (const el of a.elements ?? []) {
    const urn = el.organization;
    const id = urn?.split(":").pop();
    if (!urn || !id) continue;
    const org = await fetch(`https://api.linkedin.com/rest/organizations/${id}`, { headers: headers(token, version), cache: "no-store" });
    const o = (await org.json().catch(() => ({}))) as { localizedName?: string };
    out.push({ kind: "page", externalId: urn, name: o.localizedName ?? `Company page ${id}`, picture: null });
  }
  return out;
}

// Publishes a post as a person or organization URN. Returns its URL.
export async function linkedinPost(token: string, author: string, text: string, imageUrl: string | null): Promise<{ id: string; url: string }> {
  const k = await linkedinKeys();
  const version = k?.version ?? "202610";
  let media: string | null = null;
  if (imageUrl) {
    const init = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST", headers: headers(token, version), body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    });
    const i = (await init.json().catch(() => ({}))) as { value?: { uploadUrl?: string; image?: string } };
    if (!init.ok || !i.value?.uploadUrl || !i.value.image) throw new Error(`LinkedIn image upload: HTTP ${init.status}`);
    const img = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) });
    if (!img.ok) throw new Error("Couldn't download the image.");
    const put = await fetch(i.value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: await img.arrayBuffer() });
    if (!put.ok) throw new Error(`LinkedIn image upload: HTTP ${put.status}`);
    media = i.value.image;
  }
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST", headers: headers(token, version),
    body: JSON.stringify({
      author, commentary: text.replace(/([\\(){}\[\]<>@|~_*#])/g, "\\$1"), visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false,
      ...(media ? { content: { media: { id: media } } } : {}),
    }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(res.status === 401 ? "LinkedIn sign-in expired: reconnect LinkedIn." : `LinkedIn: ${e.message ?? `HTTP ${res.status}`}`);
  }
  const id = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id") ?? "";
  return { id, url: id ? `https://www.linkedin.com/feed/update/${id}/` : "https://www.linkedin.com/feed/" };
}
