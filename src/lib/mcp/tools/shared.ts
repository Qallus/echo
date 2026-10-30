import "server-only";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import type { McpContext } from "../auth";
import { ToolError } from "../audit";

export const id = (what: string) => z.uuid().describe(`${what} id`);
export const limitArg = z.number().int().min(1).max(100).default(25).describe("Max rows (1-100)");
export const cursorArg = z.string().max(300).optional().describe("Pass next_cursor from the previous page");
export const confirmArg = z
  .boolean()
  .optional()
  .describe("Must be true to permanently delete. Without it you get a preview of what would be deleted.");

export const SOURCES = ["phone_call", "meeting", "upload", "desktop"] as const;
export const STATUSES = ["none", "processing", "generated", "failed"] as const;

// Keyset pagination on (created_at desc, id desc).
type Cursor = { t: string; id: string };
export function decodeCursor(cursor?: string): Cursor | null {
  if (!cursor) return null;
  try {
    const c = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (typeof c.t === "string" && typeof c.id === "string" && !Number.isNaN(Date.parse(c.t))) return c;
  } catch {}
  throw new ToolError("That cursor isn't valid. Start again without one.");
}
export const cursorFilter = (c: Cursor) => `created_at.lt."${c.t}",and(created_at.eq."${c.t}",id.lt.${c.id})`;
export function nextCursor<T extends { id: string; created_at: string }>(rows: T[], limit: number) {
  if (rows.length < limit) return null;
  const last = rows[rows.length - 1];
  return Buffer.from(JSON.stringify({ t: last.created_at, id: last.id })).toString("base64url");
}

// Database errors -> sentences the caller can act on. Messages raised by our
// own guards (triggers/functions) are already written for people.
export function check(error: PostgrestError | null): void {
  if (!error) return;
  const m = error.message;
  if (/row-level security|permission denied/i.test(m)) throw new ToolError("You don't have access to do that.");
  if (error.code === "23505") throw new ToolError("That already exists.");
  if (error.code === "23503") throw new ToolError("A referenced item doesn't exist or you don't have access to it.");
  if (error.code === "22P02" || error.code === "23514") throw new ToolError("One of the values isn't allowed.");
  if (["P0001", "P0002", "42501", "22023", "54000", "28000"].includes(error.code)) throw new ToolError(m);
  throw new Error(`${error.code}: ${m}`);
}

// Data or a "not found" sentence (RLS hides rows you can't see, so both look the same).
export function found<T>(row: T | null | undefined, what: string): T {
  if (!row) throw new ToolError(`${what} not found or you don't have access.`);
  return row;
}

// Workspace of a recording the caller can see (for the audit log), or "not found".
export async function recordingWorkspace(ctx: McpContext, recordingId: string): Promise<string> {
  const { data, error } = await ctx.supabase.from("recordings").select("workspace_id").eq("id", recordingId).maybeSingle();
  check(error);
  return found(data, "Recording").workspace_id;
}
