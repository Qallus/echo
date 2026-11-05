"use server";

import { createClient } from "@/lib/supabase/server";
import { isUuid, requireUser } from "@/lib/data";
import { emailHtml, sendEmail, siteUrl } from "@/lib/notify/senders";
import { siteOrigin } from "@/lib/site";
import { linkParts, type SharePart, type ShareLink, type SharePerson } from "@/lib/share";

// Share dialog actions. All run as the signed-in user; the database functions
// (create_recording_link, share_recording, …) check access and raise
// plain-English errors, which are shown as-is.

export type ShareState = { links: ShareLink[]; people: SharePerson[]; me: string; origin: string };

export async function loadShares(recordingId: string): Promise<ShareState> {
  const user = await requireUser();
  if (!isUuid(recordingId)) throw new Error("Recording not found.");
  const supabase = await createClient();
  const [links, people] = await Promise.all([
    supabase.from("recording_links")
      .select("id, show_summary, show_transcript, show_highlights, show_audio, expires_at, revoked_at, created_by, created_at, view_count, last_viewed_at")
      .eq("recording_id", recordingId).is("revoked_at", null).order("created_at", { ascending: false }),
    supabase.from("recording_shares").select("id, email, invited_by, created_at")
      .eq("recording_id", recordingId).is("removed_at", null).order("created_at"),
  ]);
  if (links.error) throw new Error(links.error.message);
  if (people.error) throw new Error(people.error.message);
  return {
    me: user.id,
    origin: await siteOrigin(),
    links: links.data.map((l) => ({
      id: l.id, parts: linkParts(l), expiresAt: l.expires_at, revokedAt: l.revoked_at, createdBy: l.created_by,
      createdAt: l.created_at, views: l.view_count, lastViewedAt: l.last_viewed_at,
    })),
    people: people.data.map((p) => ({ id: p.id, email: p.email, invitedBy: p.invited_by, createdAt: p.created_at })),
  };
}

// Returns the link's URL. It's shown once: only its hash is stored.
export async function createShareLink(recordingId: string, parts: SharePart[], expiresDays: number | null): Promise<{ url?: string; error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_recording_link", {
    rec: recordingId,
    p_summary: parts.includes("summary"), p_transcript: parts.includes("transcript"),
    p_highlights: parts.includes("highlights"), p_audio: parts.includes("audio"),
    p_expires_days: expiresDays,
  });
  if (error) return { error: error.message };
  return { url: `${await siteOrigin()}/s/${(data as { token: string }).token}` };
}

export async function revokeShareLink(id: string): Promise<{ error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_recording_link", { p_id: id });
  return error ? { error: error.message } : {};
}

// Someone with an account is notified in the app (and by email, per their
// settings) by the database. Anyone else gets an email inviting them to sign up.
export async function shareWithPerson(recordingId: string, email: string): Promise<{ notice?: string; error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("share_recording", { rec: recordingId, p_email: email });
  if (error) return { error: error.message };
  const r = data as { already: boolean; has_account?: boolean; title?: string; sharer?: string };
  const addr = email.trim().toLowerCase();
  if (r.already) return { notice: `Already shared with ${addr}.` };
  if (r.has_account) return { notice: `Shared with ${addr}. They'll find it under Shared with me.` };

  const title = `${r.sharer ?? "Someone"} shared a recording with you`;
  const body = `"${r.title}" is waiting for you in Echo. Create a free account with this email address to open it.`;
  const url = siteUrl(`/signup?next=${encodeURIComponent(`/shared/${recordingId}`)}`);
  const sent = await sendEmail(addr, title, emailHtml({ title, body, url, cta: "Open the recording", footer: "You're receiving this because someone shared an Echo recording with this address." }),
    `${title}\n\n${body}\n\n${url}`, { idempotencyKey: `recording-share/${recordingId}/${addr}` });
  return sent.ok
    ? { notice: `Shared with ${addr}. We emailed them an invite.` }
    : { notice: `Shared with ${addr}, but the invite email didn't send (${sent.error}). Send them the link to this recording yourself.` };
}

export async function unsharePerson(id: string): Promise<{ error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("unshare_recording", { p_id: id });
  return error ? { error: error.message } : {};
}
