"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { MIN_PASSWORD } from "@/lib/auth-rules";
import { DETAIL_KINDS, MAX_DETAILS, MAX_VALUE, PREFIXES, readDetails, type ProfileDetail } from "@/lib/profile-details";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { ok?: string; error?: string; needCode?: boolean };

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max) || null;

// "linkedin.com/in/x" or "https://..." -> https URL; anything else is rejected.
function link(value: string | null): string | null | false {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.includes(".") ? url.toString() : false;
  } catch {
    return false;
  }
}

// The "Additional information" rows, sent as JSON. Empty rows are dropped.
function parseDetails(raw: FormDataEntryValue | null): ProfileDetail[] | string {
  let rows: ProfileDetail[];
  try {
    rows = readDetails(JSON.parse(String(raw ?? "[]")));
  } catch {
    return "Couldn't read the additional information. Reload and try again.";
  }
  const out: ProfileDetail[] = [];
  for (const d of rows) {
    const kind = DETAIL_KINDS.find((k) => k.kind === d.kind)!;
    let value = d.value.trim().slice(0, MAX_VALUE[d.kind] ?? 120);
    const label = d.label.trim().slice(0, 40);
    if (!value) continue;
    if (kind.single && out.some((o) => o.kind === d.kind)) return `Add only one ${kind.label.toLowerCase()}.`;
    if (d.kind === "prefix" && !PREFIXES.includes(value)) return "Choose a prefix from the list.";
    if (d.kind === "phone" && !/^\+?[\d\s().-]{7,25}$/.test(value)) return `“${value}” doesn't look like a phone number.`;
    if (d.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `“${value}” doesn't look like an email address.`;
    if (d.kind === "birthday" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter the birthday as a date.";
    if (d.kind === "website") {
      const url = link(value);
      if (!url) return `“${value}” doesn't look like a web address.`;
      value = url;
    }
    if (d.kind === "other" && !label) return "Give each custom field a name.";
    out.push({ kind: d.kind, label, value, shared: d.shared });
  }
  return out.length > MAX_DETAILS ? `Add up to ${MAX_DETAILS} extra fields.` : out;
}

function validTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function updateProfile(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const fullName = text(form, "full_name", 100);
  if (!fullName) return { error: "Enter your name." };

  const phone = text(form, "phone", 32);
  if (phone && !/^\+?[\d\s().-]{7,25}$/.test(phone)) return { error: "Enter a phone number with digits only (and +, spaces or dashes)." };
  const timezone = text(form, "timezone", 64);
  if (timezone && !validTimeZone(timezone)) return { error: "Choose a time zone from the list." };
  const website = link(text(form, "website", 200));
  const linkedin = link(text(form, "linkedin", 200));
  if (website === false) return { error: "The website doesn't look like a web address." };
  if (linkedin === false) return { error: "The LinkedIn link doesn't look like a web address." };
  const details = parseDetails(form.get("details"));
  if (typeof details === "string") return { error: details };

  const supabase = await createClient();
  const [profile, auth] = await Promise.all([
    supabase.from("profiles").update({
      full_name: fullName,
      job_title: text(form, "job_title", 100),
      company: text(form, "company", 120),
      phone,
      phone_visible: form.get("phone_visible") === "on",
      timezone,
      location: text(form, "location", 100),
      bio: text(form, "bio", 500),
      website,
      linkedin,
      details,
    }).eq("id", user.id),
    supabase.auth.updateUser({ data: { full_name: fullName } }), // used by the email templates
  ]);
  if (profile.error || auth.error) return { error: profile.error?.message ?? auth.error?.message };
  revalidatePath("/", "layout");
  return { ok: "Profile saved." };
}

// Photos live at avatars/<user_id>/<file>; the browser uploads, then we point
// the profile at it and delete the previous ones.
async function setAvatarUrl(url: string | null) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { error: error.message };
  const keep = url?.split(`/avatars/${user.id}/`)[1];
  const { data: files } = await supabase.storage.from("avatars").list(user.id);
  const old = (files ?? []).filter((f) => f.name !== keep).map((f) => `${user.id}/${f.name}`);
  if (old.length) await supabase.storage.from("avatars").remove(old);
  revalidatePath("/", "layout");
  return {};
}

export async function setAvatar(url: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
  if (!url.startsWith(prefix)) return { error: "That photo isn't in your folder." };
  return setAvatarUrl(url);
}

export async function removeAvatar(): Promise<{ error?: string }> {
  return setAvatarUrl(null);
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
    { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/settings/account` },
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
