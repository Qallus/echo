import { streamText, type ModelMessage } from "ai";
import { isModelId } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import { buildLibraryPrompt, buildRecordingPrompt } from "@/lib/ai/context";
import { getUser } from "@/lib/data";

// POST { modelId, recordingId?, messages: [{ role, content }] } -> plain text stream.
// Requires a signed-in user; recording access is enforced by RLS when the context loads.

const MAX_MESSAGES = 40;
const MAX_CHARS = 20_000;

export async function POST(req: Request) {
  if (!(await getUser())) return Response.json({ error: "Sign in to use Ask Echo." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !isModelId(body.modelId) || !Array.isArray(body.messages)) {
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

  const picked = getLanguageModel(body.modelId);
  if ("error" in picked) return Response.json({ error: picked.error }, { status: 503 });

  const result = streamText({
    model: picked.model,
    system,
    messages,
    abortSignal: req.signal,
    onError: ({ error }) => console.error(`[chat:${body.modelId}]`, error),
  });

  // Wait for the first text (or failure) before answering, so a provider error
  // (bad key, unknown model) reaches the user instead of an empty reply.
  const parts = result.fullStream[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  let first: string | null = null;
  for (;;) {
    const { done, value } = await parts.next();
    if (done) break;
    if (value.type === "error") {
      const message = value.error instanceof Error ? value.error.message : String(value.error);
      return Response.json({ error: `${picked.label} couldn't answer: ${message}` }, { status: 502 });
    }
    if (value.type === "text-delta") { first = value.text; break; }
  }
  if (first === null) return Response.json({ error: `${picked.label} returned no text.` }, { status: 502 });

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
