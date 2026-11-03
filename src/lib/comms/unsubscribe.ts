import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/notify/senders";

// Signed unsubscribe links: /unsubscribe?e=<email>&t=<token>. The token is an
// HMAC of the email with a key derived from AI_KEYS_SECRET, so links can't be
// forged for someone else's address.

function key() {
  const secret = process.env.AI_KEYS_SECRET;
  if (!secret) throw new Error("AI_KEYS_SECRET isn't set.");
  return createHmac("sha256", secret).update("echo-unsubscribe-v1").digest();
}

const sign = (email: string) => createHmac("sha256", key()).update(email.trim().toLowerCase()).digest("base64url");

export const unsubscribeUrl = (email: string) => siteUrl(`/unsubscribe?e=${encodeURIComponent(email.trim().toLowerCase())}&t=${sign(email)}`);

export function verifyUnsubscribe(email: string, token: string) {
  const a = Buffer.from(sign(email)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
