import { createHash } from "node:crypto";
import { decryptKey } from "@/lib/ai/keys";
import { sipConfig } from "@/lib/comms/sip";
import { firmwareFrom, provisionFile } from "@/lib/redial/provision";
import { createAdminClient } from "@/lib/supabase/admin";

// Auto-setup for desk, cordless and Wi-Fi phones: the phone downloads
// /api/provision/<token>/<file>. No user session; the long random token in
// the path is the secret (only its hash is stored), and the file name must
// be this phone's own MAC address. Anything else gets a plain 404.

const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function GET(req: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  const { token, file } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token) || !/^[\w.-]{1,64}$/.test(file)) return notFound();
  const db = createAdminClient();
  const { data: d } = await db.from("redial_devices").select("id, vendor, mac, label, sip_username, secret_enc")
    .eq("provision_token_hash", createHash("sha256").update(token).digest("hex")).maybeSingle();
  if (!d?.mac) return notFound();
  const sip = await sipConfig();
  if (!sip.domain) return notFound();
  let password: string;
  try { password = decryptKey(d.secret_enc); } catch { return notFound(); }
  const out = provisionFile(d.vendor, file, { mac: d.mac, label: d.label, username: d.sip_username, password, domain: sip.domain });
  if (!out) return notFound();
  // First download = set up; every download = a check-in (Online status and
  // firmware). The check-in columns arrive in a later database update, so
  // they're written separately and a failure there changes nothing else.
  const now = new Date().toISOString();
  await db.from("redial_devices").update({ last_provisioned_at: now }).eq("id", d.id).is("last_provisioned_at", null);
  const firmware = firmwareFrom(req.headers.get("user-agent"));
  await db.from("redial_devices").update({ last_seen_at: now, ...(firmware ? { firmware } : {}) }).eq("id", d.id);
  return new Response(out.body, { headers: { "content-type": `${out.type}; charset=utf-8`, "cache-control": "no-store" } });
}
