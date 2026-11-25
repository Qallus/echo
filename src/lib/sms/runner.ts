import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { twilioRequest, twilioSms } from "@/lib/comms/twilio";
import { segmentsOf } from "./pricing";

// The cron job's SMS work (service role):
//  * scheduled texts from customers' lines that are due, sent from the line's
//    own number, skipping numbers that replied STOP, stopping when the line
//    owner runs out of texts;
//  * Twilio's actual price for recent texts on customer lines (for Admin →
//    Billing → SMS billing).

type Due = { id: string; line_id: string; to_numbers: string[]; body: string; created_by: string | null };

export async function runLineScheduled(db: SupabaseClient, budgetMs = 60_000): Promise<number> {
  const started = Date.now();
  const { data, error } = await db.from("line_scheduled_texts").select("id, line_id, to_numbers, body, created_by")
    .eq("status", "scheduled").lte("send_at", new Date().toISOString()).order("send_at").limit(20);
  if (error || !data?.length) return 0;
  let done = 0;
  for (const s of data as Due[]) {
    if (Date.now() - started > budgetMs) break;
    // Claim it so two runs never send it twice.
    const { data: claimed } = await db.from("line_scheduled_texts").update({ status: "sending", claimed_at: new Date().toISOString() })
      .eq("id", s.id).eq("status", "scheduled").select("id");
    if (!claimed?.length) continue;
    const { data: line } = await db.from("redial_lines").select("id, number").eq("id", s.line_id).maybeSingle();
    if (!line) { await db.from("line_scheduled_texts").update({ status: "failed", error: "The line no longer exists." }).eq("id", s.id); continue; }
    const segments = segmentsOf(s.body);
    const { data: usage } = await db.rpc("sms_line_usage", { p_line: s.line_id });
    let remaining = (usage as { remaining?: number } | null)?.remaining ?? Infinity;
    const { data: stops } = await db.from("phone_opt_outs").select("number").in("number", s.to_numbers);
    const blocked = new Set((stops ?? []).map((r) => r.number as string));
    let sent = 0, failed = 0;
    const errors: string[] = [];
    for (const to of s.to_numbers) {
      if (blocked.has(to)) { failed++; errors.push(`${to} replied STOP`); continue; }
      if (remaining < segments) { failed++; errors.push(`${to}: out of texts`); continue; }
      const res = await twilioSms(to, s.body, line.number);
      await db.from("phone_messages").insert({
        direction: "outbound", from_number: line.number, to_number: to, body: s.body, line_id: line.id, segments, sent_by: s.created_by,
        status: res.ok ? res.status ?? "sent" : "failed", error: res.ok ? null : (res.error ?? "Not sent").slice(0, 500), twilio_sid: res.sid ?? null,
      });
      if (res.ok) { sent++; remaining -= segments; } else { failed++; errors.push(`${to}: ${res.error ?? "not sent"}`); }
    }
    await db.from("line_scheduled_texts").update({
      status: failed === 0 ? "sent" : sent === 0 ? "failed" : "partly_sent", sent, failed, error: errors.join("; ").slice(0, 2000) || null,
    }).eq("id", s.id);
    if (failed && s.created_by) {
      await db.from("notifications").insert({
        user_id: s.created_by, type: "text_scheduled", title: sent ? `Scheduled text sent to ${sent}, ${failed} not sent` : "Scheduled text wasn't sent",
        body: errors.join("; ").slice(0, 300), url: "/sms",
      });
    }
    done++;
  }
  return done;
}

// Twilio's price arrives a little after a text is sent; fill it in later.
export async function fillTextCosts(db: SupabaseClient, max = 50): Promise<number> {
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await db.from("phone_messages").select("id, twilio_sid").not("line_id", "is", null).is("price_cents", null)
    .not("twilio_sid", "is", null).gte("created_at", since).lte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString()).limit(max);
  if (error || !data?.length) return 0;
  let n = 0;
  for (const m of data) {
    const r = await twilioRequest(`/Messages/${m.twilio_sid}.json`, {}, "GET");
    const price = r.ok && r.data.price != null ? Math.abs(Number(r.data.price)) * 100 : null;
    if (price == null || !Number.isFinite(price)) continue;
    const segs = Number(r.data.num_segments);
    await db.from("phone_messages").update({ price_cents: price, ...(segs > 0 ? { segments: Math.min(segs, 20) } : {}) }).eq("id", m.id);
    n++;
  }
  return n;
}
