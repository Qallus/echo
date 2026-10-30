"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { MIN_PASSWORD } from "@/lib/auth-rules";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { ok?: string; error?: string; needCode?: boolean };

export async function updateName(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const fullName = String(form.get("full_name") ?? "").trim().slice(0, 120);
  if (!fullName) return { error: "Enter your name." };
  const supabase = await createClient();
  const [profile, auth] = await Promise.all([
    supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id),
    supabase.auth.updateUser({ data: { full_name: fullName } }), // used by the email templates
  ]);
  if (profile.error || auth.error) return { error: profile.error?.message ?? auth.error?.message };
  revalidatePath("/", "layout");
  return { ok: "Name saved." };
}

// Supabase emails a confirmation link to the new address (and the old one,
// with secure email change on). The change applies once confirmed.
export async function changeEmail(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (email === user.email.toLowerCase()) return { error: "That's already your email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/settings` },
  );
  if (error) return { error: error.message };
  return { ok: `Check ${email} (and your current inbox) for a link to confirm the change.` };
}

// When Supabase requires recent sign-in for password changes, the first try
// returns "reauthentication needed": we email a code and ask for it.
export async function changePassword(_: SettingsState, form: FormData): Promise<SettingsState> {
  await requireUser();
  const password = String(form.get("password") ?? "");
  const code = String(form.get("code") ?? "").trim();
  if (password.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.` };
  if (password !== form.get("confirm")) return { error: "The passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password, ...(code ? { nonce: code } : {}) });
  if (!error) return { ok: "Password saved." };
  if (error.code === "reauthentication_needed" || /reauthenticat/i.test(error.message)) {
    const re = await supabase.auth.reauthenticate();
    if (re.error) return { error: re.error.message, needCode: true };
    return { needCode: true, error: code ? "That code didn't work. We sent a new one." : undefined };
  }
  if (error.code === "same_password") return { error: "Choose a password you haven't used here before." };
  return { error: error.message };
}

export async function signOutEverywhere() {
  await requireUser();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
