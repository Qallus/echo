import "server-only";
import { sendEmail, emailHtml, siteUrl } from "@/lib/notify/senders";
import { twilioRequest } from "@/lib/comms/twilio";
import type { createAdminClient } from "@/lib/supabase/admin";

// Selling phone numbers. People pick a real available number (/numbers),
// it's paid for at checkout ($5/mo alone, $2.50/mo with a Redial plan), and
// after payment the Stripe webhook calls provisionNumber(): buy it from
// Twilio (or the closest match if it was just taken), point its calls and
// texts at Redial, create the buyer's line and tell them it's ready.

type Db = ReturnType<typeof createAdminClient>;
export const NUMBER_PRODUCT = "redial_number";
export const NUMBER_PRICE = "redial_number_monthly"; // on its own
export const NUMBER_PLAN_PRICE = "redial_number_plan_monthly"; // with a Redial plan
export const isNumberKey = (key: string) => key === NUMBER_PRICE || key === NUMBER_PLAN_PRICE;

const TOLL_FREE = /^\+18(00|33|44|55|66|77|88)/;
const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const kindOf = (n: string) => (TOLL_FREE.test(n) ? "TollFree" : "Local");

// Is this exact number still for sale? null when Twilio couldn't be asked.
export async function stillAvailable(number: string): Promise<boolean | null> {
  const digits = number.replace(/^\+1/, "");
  const r = await twilioRequest(`/AvailablePhoneNumbers/US/${kindOf(number)}.json`, { Contains: digits, PageSize: "5" }, "GET");
  if (!r.ok) return null;
  return ((r.data.available_phone_numbers ?? []) as { phone_number: string }[]).some((n) => n.phone_number === number);
}

// Twilio settings for a Redial number: calls to the screening assistant, texts to the inbox.
const hooks = () => ({
  VoiceUrl: siteUrl("/api/webhooks/twilio/redial/voice"), VoiceMethod: "POST",
  StatusCallback: siteUrl("/api/webhooks/twilio/redial/status"), StatusCallbackMethod: "POST",
  SmsUrl: siteUrl("/api/webhooks/twilio/sms"), SmsMethod: "POST",
});

async function buy(number: string, label: string) {
  const r = await twilioRequest("/IncomingPhoneNumbers.json", { PhoneNumber: number, FriendlyName: label.slice(0, 64), ...hooks() });
  return r.ok ? { sid: String(r.data.sid), number: String(r.data.phone_number) } : { error: String(r.data.message ?? `Twilio ${r.status}`) };
}

// The closest available numbers to one that was taken: same area code, then the same digits nearby.
async function alternatives(number: string): Promise<string[]> {
  const kind = kindOf(number);
  const area = number.slice(2, 5);
  const r = await twilioRequest(`/AvailablePhoneNumbers/US/${kind}.json`, { AreaCode: area, PageSize: "5", VoiceEnabled: "true" }, "GET");
  return r.ok ? ((r.data.available_phone_numbers ?? []) as { phone_number: string }[]).map((n) => n.phone_number) : [];
}

export async function provisionNumber(db: Db, o: { userId: string; email: string | null; picked: string; sessionId: string; priceKey: string | null }) {
  const { data: existing } = await db.from("redial_number_orders").select("id, status").eq("checkout_session_id", o.sessionId).maybeSingle();
  if (existing?.status === "active") return; // Stripe retried; already done
  const { data: order, error } = existing
    ? { data: existing, error: null }
    : await db.from("redial_number_orders").insert({ user_id: o.userId, checkout_session_id: o.sessionId, picked_number: o.picked, price_key: o.priceKey }).select("id, status").single();
  if (error || !order) throw new Error(`number order: ${error?.message}`);

  const label = `Redial · ${o.email ?? o.userId}`;
  let bought = await buy(o.picked, label);
  if ("error" in bought) {
    for (const alt of await alternatives(o.picked)) {
      bought = await buy(alt, label);
      if (!("error" in bought)) break;
    }
  }
  if ("error" in bought) {
    await db.from("redial_number_orders").update({ status: "needs_attention", error: `Couldn't buy ${o.picked} or a close match: ${bought.error}`.slice(0, 500) }).eq("id", order.id);
    await db.from("notifications").insert({
      user_id: o.userId, type: "redial_number", title: "We're choosing your number", url: "/calls",
      body: `${pretty(o.picked)} was taken just before your order. Our team will set up a close match and email you shortly.`,
    });
    return;
  }

  const { data: lineId, error: lineErr } = await db.rpc("redial_provision_line", { p_user: o.userId, p_number: bought.number, p_label: "My Redial number" });
  if (lineErr) {
    await db.from("redial_number_orders").update({ status: "needs_attention", number: bought.number, twilio_sid: bought.sid, error: `Bought, but the line wasn't created: ${lineErr.message}`.slice(0, 500) }).eq("id", order.id);
    return;
  }
  await db.from("redial_number_orders").update({ status: "active", number: bought.number, twilio_sid: bought.sid, line_id: lineId, error: null }).eq("id", order.id);

  const changed = bought.number !== o.picked;
  const title = `Your Redial number is ready: ${pretty(bought.number)}`;
  const body = changed
    ? `${pretty(o.picked)} was taken just before your order, so we got you ${pretty(bought.number)} in the same area code. Your assistant answers it now; set it up in Calls.`
    : `${pretty(bought.number)} is yours. Your assistant answers it now; choose how it screens calls in Calls.`;
  await db.from("notifications").insert({ user_id: o.userId, type: "redial_number", title, body, url: "/calls" });
  if (o.email) {
    await sendEmail(o.email, title, emailHtml({ title, body, url: siteUrl("/calls"), cta: "Set up my number" }), `${body}\n\n${siteUrl("/calls")}`,
      { idempotencyKey: `redial-number/${o.sessionId}` }).catch(() => {});
  }
}
