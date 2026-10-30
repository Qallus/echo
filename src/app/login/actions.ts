"use server";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { siteOrigin } from "@/lib/site";

export type LoginState = { sent?: string; error?: string };

export async function sendMagicLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  const next = safeNext(String(form.get("next") ?? "/"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: error.message };
  return { sent: email };
}

export async function googleSignInUrl(next: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (error) return { error: error.message };
  return { url: data.url };
}
