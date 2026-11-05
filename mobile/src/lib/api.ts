// Calls the Echo website's mobile API (/api/mobile/<name>, see
// docs/MOBILE_API.md) as the signed-in member.
import { API_URL } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function token(refresh = false) {
  const { data } = refresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function call<T>(path: string, init: RequestInit, retried = false): Promise<T> {
  const t = await token(retried);
  if (!t) throw new ApiError("Sign in again.", 401);
  const res = await fetch(`${API_URL}/api/mobile/${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${t}`, Accept: "application/json" },
  });
  if (res.status === 401 && !retried) return call<T>(path, init, true); // token expired: refresh once
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? `Something went wrong (${res.status}).`, res.status);
  return body as T;
}

export function get<T>(name: string, query: Record<string, string> = {}) {
  const q = new URLSearchParams(query).toString();
  return call<T>(q ? `${name}?${q}` : name, { method: "GET" });
}

export function post<T = { ok?: string }>(name: string, body: unknown) {
  return call<T>(name, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
