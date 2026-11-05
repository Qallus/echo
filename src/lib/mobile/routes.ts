import "server-only";
import { z } from "zod";
import { getRecordingDetail, getUser, listRecordings, listWorkspaces } from "@/lib/data";
import { toggleActionItem } from "@/lib/actions";
import { audioUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { callsBadge, lineDetail, myLines } from "@/lib/redial/data";
import {
  addCallback, addListEntry, deleteCallback, directAgent, dismissSuggestion, liveCalls, removeListEntry, removeListener,
  saveLine, sendSuggestion, setCallbackDone, startListening, startMirror, stopMirror, takeOver, transferCall, updateCall, voicemailUrl,
} from "@/lib/redial/actions";

// The Redial app's API: /api/mobile/<name>. Each entry checks the input's
// shape and calls the same reads and server actions the web uses, running as
// the member (see src/lib/mobile/context.ts), so RLS and the database checks
// are identical. GET entries read the query string; POST entries a JSON body.

const id = z.uuid();
type Route = { method: "GET" | "POST"; input: z.ZodType; run: (input: never) => Promise<unknown> };
const route = <S extends z.ZodType>(method: Route["method"], input: S, run: (input: z.infer<S>) => Promise<unknown>): Route =>
  ({ method, input, run: run as Route["run"] });
const none = z.object({});

async function lineAccess(lineId: string) {
  const line = (await myLines()).find((l) => l.id === lineId);
  if (!line) throw new Error("Line not found.");
  return line;
}

export const ROUTES: Record<string, Route> = {
  // Account
  me: route("GET", none, async () => {
    const user = await getUser();
    const supabase = await createClient();
    const [{ data: profile }, workspaces, lines, unread] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url, timezone, push_privacy").eq("id", user!.id).maybeSingle(),
      listWorkspaces(), myLines(), callsBadge(),
    ]);
    return { user, profile, workspaces, lines, unreadCalls: unread };
  }),
  "settings.push-privacy": route("POST", z.object({ level: z.enum(["full", "caller", "private"]) }), async ({ level }) => {
    const user = await getUser();
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ push_privacy: level }).eq("id", user!.id);
    return error ? { error: error.message } : { ok: "Saved." };
  }),
  "devices.register": route("POST", z.object({ token: z.string().max(300), platform: z.enum(["android", "ios"]), appVersion: z.string().max(40).optional() }),
    async ({ token, platform, appVersion }) => {
      const supabase = await createClient();
      const { error } = await supabase.rpc("register_device", { p_token: token, p_platform: platform, p_app_version: appVersion ?? null });
      return error ? { error: error.message } : { ok: "Registered." };
    }),
  "devices.unregister": route("POST", z.object({ token: z.string().max(300) }), async ({ token }) => {
    const supabase = await createClient();
    const { error } = await supabase.from("device_tokens").delete().eq("token", token);
    return error ? { error: error.message } : { ok: "Removed." };
  }),

  // Redial: lines, calls, callbacks, rules
  line: route("GET", z.object({ line: id }), async ({ line }) => {
    const l = await lineAccess(line);
    return { line: l, ...(await lineDetail(l.id, l.access)) };
  }),
  "calls.update": route("POST", z.object({
    id, patch: z.object({ read: z.boolean().optional(), archived: z.boolean().optional(), category: z.enum(["personal", "business", "sales", "spam", "unknown"]).optional() }),
  }), ({ id, patch }) => updateCall(id, patch)),
  "calls.voicemail": route("POST", z.object({ path: z.string().max(500) }), ({ path }) => voicemailUrl(path)),
  "callbacks.add": route("POST", z.object({
    lineId: id, callId: id.nullish(), name: z.string().max(200), number: z.string().max(40), due: z.string().max(40), timezone: z.string().max(80), note: z.string().max(2000),
  }), (input) => addCallback(input)),
  "callbacks.done": route("POST", z.object({ id, done: z.boolean() }), ({ id, done }) => setCallbackDone(id, done)),
  "callbacks.delete": route("POST", z.object({ id }), ({ id }) => deleteCallback(id)),
  "rules.save": route("POST", z.object({
    lineId: id,
    settings: z.object({
      label: z.string().max(60), forward_to: z.string().max(40), mode: z.enum(["all", "unknown", "off", "spam"]), paused: z.boolean(), allow_connect: z.boolean(),
      assistant_name: z.string().max(40), voice: z.string().max(40), greeting: z.string().max(500), about: z.string().max(4000), max_seconds: z.number(),
    }),
  }), ({ lineId, settings }) => saveLine(lineId, settings)),
  "lists.add": route("POST", z.object({ lineId: id, number: z.string().max(40), kind: z.enum(["allow", "block", "vip"]), label: z.string().max(100) }),
    ({ lineId, number, kind, label }) => addListEntry(lineId, number, kind, label)),
  "lists.remove": route("POST", z.object({ id }), ({ id }) => removeListEntry(id)),

  // Redial: live calls (Insider, Gavel, Audible, Directory, Mirror)
  live: route("GET", z.object({ line: id }), async ({ line }) => ({ calls: await liveCalls(line) })),
  "live.listen": route("POST", z.object({ callId: id }), ({ callId }) => startListening(callId)),
  "live.stop-listening": route("POST", z.object({ participantId: id }), ({ participantId }) => removeListener(participantId)),
  "live.take-over": route("POST", z.object({ callId: id }), ({ callId }) => takeOver(callId)),
  "live.direct": route("POST", z.object({ callId: id, text: z.string().max(500) }), ({ callId, text }) => directAgent(callId, text)),
  "live.transfer": route("POST", z.object({
    callId: id, to: z.object({ destinationId: id.optional(), number: z.string().max(40).optional(), confirmed: z.boolean().optional() }),
  }), ({ callId, to }) => transferCall(callId, to)),
  "mirror.start": route("POST", z.object({ callId: id }), ({ callId }) => startMirror(callId)),
  "mirror.stop": route("POST", z.object({ callId: id }), ({ callId }) => stopMirror(callId)),
  "mirror.dismiss": route("POST", z.object({ id }), ({ id }) => dismissSuggestion(id)),
  "mirror.send": route("POST", z.object({ id, draft: z.object({ to: z.string().max(320), subject: z.string().max(200).optional(), body: z.string().max(5000) }) }),
    ({ id, draft }) => sendSuggestion(id, draft)),

  // Echo: recordings
  recordings: route("GET", none, async () => {
    const [recordings, workspaces] = await Promise.all([listRecordings(), listWorkspaces()]);
    return { recordings: recordings.filter((r) => !r.deletedAt), workspaces };
  }),
  recording: route("GET", z.object({ id }), async ({ id }) => {
    const detail = await getRecordingDetail(id);
    if (!detail) return { error: "Recording not found." };
    const supabase = await createClient();
    const { data: file } = await supabase.from("recordings").select("storage_path").eq("id", id).single();
    return { ...detail, audioUrl: await audioUrl(supabase, file?.storage_path ?? null) };
  }),
  "action-items.toggle": route("POST", z.object({ id, done: z.boolean() }), ({ id, done }) => toggleActionItem(id, done)),
};
