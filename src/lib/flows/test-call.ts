import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { secret } from "@/lib/secrets";

// Browser test calls of a call tree: the person gets a short-lived ticket for
// one call tree, passed as a call parameter; the voice webhook checks it
// before starting a test run. Signed with the Twilio auth token.

const TTL_SECONDS = 600;

const sign = (key: string, body: string) => createHmac("sha256", key).update(`call-tree-test:${body}`).digest("base64url");

export async function makeTestTicket(flowId: string): Promise<string | null> {
  const key = await secret("TWILIO_AUTH_TOKEN");
  if (!key) return null;
  const body = `${flowId}.${Math.floor(Date.now() / 1000) + TTL_SECONDS}`;
  return `${body}.${sign(key, body)}`;
}

export async function readTestTicket(ticket: string): Promise<string | null> {
  const key = await secret("TWILIO_AUTH_TOKEN");
  const [flowId, exp, sig] = ticket.split(".");
  if (!key || !flowId || !exp || !sig || !/^[0-9a-f-]{36}$/i.test(flowId)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  const want = Buffer.from(sign(key, `${flowId}.${exp}`));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? flowId : null;
}
