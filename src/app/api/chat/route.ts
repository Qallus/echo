import { streamText, type ModelMessage } from "ai";
import { isModelChoice, logUsage, reportKeyFailure, resolveCandidates } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import { buildLibraryPrompt, buildRecordingPrompt } from "@/lib/ai/context";
import { getUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// POST { modelId, recordingId?, messages: [{ role, content }] } -> plain text stream.
// Requires a signed-in user; recording access is enforced by RLS when the context loads.
// Uses the customer's own key when they have one, falling back to Echo's.

const MAX_MESSAGES = 40;
const MAX_CHARS = 20_000;

export async function POST(req: Request) {
  if (!(await getUser())) return Response.json({ error: "Sign in to use Ask Echo." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !isModelChoice(body.modelId) || !Array.isArray(body.messages)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const messages: ModelMessage[] = body.messages
    .slice(-MAX_MESSAGES)
    .filter((m: { role?: string; content?: unknown }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!messages.length || messages.at(-1)?.role !== "user") {
    return Response.json({ error: "Last message must be from the user." }, { status: 400 });
  }

  let system: string;
  if (typeof body.recordingId === "string") {
    const prompt = await buildRecordingPrompt(body.recordingId);
    if (!prompt) return Response.json({ error: "Recording not found." }, { status: 404 });
    system = prompt;
  } else {
    system = await buildLibraryPrompt();
  }

  const supabase = await createClient();
  let workspaceId: string | null = null;
  if (typeof body.recordingId === "string") {
    const { data } = await supabase.from("recordings").select("workspace_id").eq("id", body.recordingId).maybeSingle();
    workspaceId = data?.workspace_id ?? null;
  }
  const settings = await getAiSettings(supabase);
  const candidates = await resolveCandidates(supabase, body.modelId, { workspaceId, settings });
  if (!candidates.length) return Response.json({ error: "This model isn't available. Add your own key under Settings → AI models, or pick another." }, { status: 503 });

  const encoder = new TextEncoder();
  let lastError = "";
  for (const [i, picked] of candidates.entries()) {
    const started = Date.now();
    const fallback = i > 0;
    const result = streamText({
      model: picked.model,
      system,
      messages,
      abortSignal: req.signal,
      onError: ({ error }) => console.error(`[chat:${body.modelId}:${picked.keySource}]`, error),
      onFinish: ({ totalUsage }) => void logUsage(supabase, {
        workspaceId, feature: "chat", resolved: picked, fallback, settings, latencyMs: Date.now() - started,
        inputTokens: totalUsage.inputTokens, outputTokens: totalUsage.outputTokens,
      }),
    });

    // Wait for the first text (or failure) before answering, so a provider
    // error (bad key, unknown model) can fall back or reach the user instead
    // of an empty reply.
    const parts = result.fullStream[Symbol.asyncIterator]();
    let first: string | null = null;
    let failed: unknown = null;
    for (;;) {
      const { done, value } = await parts.next();
      if (done) break;
      if (value.type === "error") { failed = value.error; break; }
      if (value.type === "text-delta") { first = value.text; break; }
    }
    if (failed !== null || first === null) {
      lastError = failed instanceof Error ? failed.message : failed ? String(failed) : "no text";
      if (picked.keyId) await reportKeyFailure(supabase, picked.keyId, failed ?? "returned no text");
      void logUsage(supabase, { workspaceId, feature: "chat", resolved: picked, fallback, settings, ok: false, error: lastError, latencyMs: Date.now() - started });
      continue;
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(encoder.encode(first!)); },
      async pull(controller) {
        const { done, value } = await parts.next();
        if (done) return controller.close();
        if (value.type === "text-delta") controller.enqueue(encoder.encode(value.text));
        else if (value.type === "error") controller.close();
      },
      cancel() { parts.return?.(); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return Response.json({ error: `${candidates[0].label} couldn't answer: ${lastError}` }, { status: 502 });
}
