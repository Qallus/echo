import { getUser } from "@/lib/data";
import { TTS_PROVIDERS, listVoices, providerConfigured } from "@/lib/studio/tts";

// GET /api/studio/voices: the AI voice engines, whether each has a key, and
// their voices.
export async function GET() {
  if (!(await getUser())) return Response.json({ error: "Sign in to use the studio." }, { status: 401 });
  const providers = await Promise.all(TTS_PROVIDERS.map(async (p) => ({
    id: p.id, label: p.label, configured: await providerConfigured(p.id), voices: await listVoices(p.id),
  })));
  return Response.json({ providers });
}
