"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { MIN_PASSWORD } from "@/lib/auth-rules";
import { siteOrigin } from "@/lib/site";

// Sign in, sign up and password reset. Supabase Auth does the work; these
// validate input and turn its errors into plain sentences.

export type LoginState = { sent?: string; error?: string; unconfirmed?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const callback = async (next: string) => `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  if (/weak|pwned|leaked/i.test(message)) return "Choose a stronger password that isn't used on other sites.";
  return message;
}

export async function sendMagicLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const next = safeNext(String(form.get("next") ?? "/"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: await callback(next) } });
  if (error) return { error: friendly(error.message) };
  return { sent: email };
}

export async function signInWithPassword(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));
  if (!EMAIL.test(email) || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") return { unconfirmed: email, error: "Confirm your email first. Check your inbox for the link." };
    return { error: friendly(error.message) };
  }
  redirect(next);
}

export async function resendConfirmation(email: string): Promise<LoginState> {
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: await callback("/") } });
  if (error) return { error: friendly(error.message) };
  return { sent: email };
}

// Account types: Personal, or Business (also creates the company's workspace,
// done by the sign-up trigger from this metadata). Team members join by invite.
export async function signUp(_: LoginState, form: FormData): Promise<LoginState> {
  const fullName = String(form.get("full_name") ?? "").trim().slice(0, 120);
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const accountType = form.get("account_type") === "business" ? "business" : "personal";
  const company = String(form.get("company_name") ?? "").trim().slice(0, 120);
  const next = safeNext(String(form.get("next") ?? "/"));

  if (!fullName) return { error: "Enter your name." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters for your password.` };
  if (accountType === "business" && !company) return { error: "Enter your company or team name." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await callback(next),
      data: { full_name: fullName, account_type: accountType, ...(accountType === "business" ? { company_name: company } : {}) },
    },
  });
  if (error) return { error: friendly(error.message) };
  if (data.session) redirect(next); // email confirmation turned off
  return { sent: email };
}

export async function requestPasswordReset(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: await callback("/reset-password") });
  // Same answer whether or not the account exists.
  if (error && /rate limit|too many/i.test(error.message)) return { error: friendly(error.message) };
  return { sent: email };
}

// /reset-password: the recovery link has already signed the user in.
export async function setNewPassword(_: LoginState, form: FormData): Promise<LoginState> {
  const password = String(form.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.` };
  if (password !== form.get("confirm")) return { error: "The passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendly(error.message) };
  redirect("/");
}

export async function googleSignInUrl(next: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callback(safeNext(next)) },
  });
  if (error) return { error: error.message };
  return { url: data.url };
}
