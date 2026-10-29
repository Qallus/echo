import { connection } from "next/server";
import { MODELS } from "@/lib/ai/models";
import { isConfigured } from "@/lib/ai/providers";

// Which models have an API key on this server. Never returns the keys.
export async function GET() {
  await connection(); // read env at request time, not build time
  return Response.json(MODELS.map((m) => ({ ...m, available: isConfigured(m.id) })));
}
