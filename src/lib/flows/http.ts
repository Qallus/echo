import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { render, type Vars } from "./eval";

// The HTTP / webhook block: one request to a public https address, 5 second
// limit, 64 KB of response kept. The host's real addresses are checked so a
// call tree can't reach private networks (including by a DNS name that points
// at one). Redirects aren't followed.

const TIMEOUT_MS = 5000;
const MAX_BYTES = 64 * 1024;

function privateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:")
    && privateAddress(v6.slice(7));
}

export async function publicHost(url: URL): Promise<boolean> {
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !privateAddress(a.address));
  } catch {
    return false;
  }
}

export async function callWebhook(cfg: { method: string; url: string; headers?: { name: string; value: string }[]; body?: string }, vars: Vars):
  Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  let url: URL;
  try { url = new URL(render(cfg.url, vars)); } catch { return { ok: false, status: 0, body: null, error: "bad url" }; }
  if (!(await publicHost(url))) return { ok: false, status: 0, body: null, error: "address not allowed" };
  const headers = new Headers({ "user-agent": "Redial-Call-Tree/1", "content-type": "application/json" });
  for (const h of cfg.headers ?? []) {
    if (/^[A-Za-z0-9-]{1,60}$/.test(h.name) && !/^(host|content-length|connection)$/i.test(h.name)) headers.set(h.name, render(h.value, vars).slice(0, 500));
  }
  try {
    const res = await fetch(url, {
      method: cfg.method, headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS),
      body: cfg.method === "GET" ? undefined : render(cfg.body ?? "", vars).slice(0, 8000) || undefined,
    });
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader && size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader?.cancel().catch(() => {});
    const text = new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* not JSON */ }
    return { ok: res.status >= 200 && res.status < 300, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e instanceof Error ? e.name : "failed" };
  }
}
