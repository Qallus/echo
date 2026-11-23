import "server-only";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/site";

// The short-lived state cookie for Connect LinkedIn / Connect Facebook, and
// the redirect back to Admin -> Social with a result.
export const socialCookie = (provider: "linkedin" | "meta") => `redial_${provider}_oauth`;
export const newState = () => randomBytes(24).toString("base64url");

export async function backToSocial(q: string, provider?: "linkedin" | "meta") {
  const res = NextResponse.redirect(new URL(`/admin/social?${q}`, await siteOrigin()));
  if (provider) res.cookies.delete({ name: socialCookie(provider), path: `/api/integrations/${provider}` });
  return res;
}

export function withState(url: string, provider: "linkedin" | "meta", state: string) {
  const res = NextResponse.redirect(url);
  res.cookies.set(socialCookie(provider), state, { httpOnly: true, secure: true, sameSite: "lax", path: `/api/integrations/${provider}`, maxAge: 600 });
  return res;
}
