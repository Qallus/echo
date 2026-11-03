import "server-only";
import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/data";

// Input cleaning shared by the CRM server actions.

export type Result = { ok?: string; error?: string; id?: string };

export const text = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};
export const ref = (v: unknown) => (typeof v === "string" && isUuid(v) ? v : null);
export const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
export const list = (v: unknown, maxItems = 20, maxLen = 40) => {
  const items = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  return [...new Set(items.filter((t): t is string => typeof t === "string").map((t) => t.trim().slice(0, maxLen)).filter(Boolean))].slice(0, maxItems);
};
export function email(v: unknown): string | null | false {
  const s = text(v, 200);
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : false;
}
export function cents(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[$,\s]/g, "") || 0);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) : null;
}
export const uuids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && isUuid(x)).slice(0, 500) : []);

export function refresh() {
  for (const p of ["/admin/clients", "/admin/contacts", "/admin/leads", "/admin/pipeline"]) revalidatePath(p, "layout");
}
