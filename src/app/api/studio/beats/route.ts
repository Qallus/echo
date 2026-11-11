import { getUser } from "@/lib/data";
import { secret } from "@/lib/secrets";

export const maxDuration = 60;

// AI Beats for the Recording Studio (ported from Channel Cast): turns a short
// description into a drum and melody pattern for the Drum Machine.

const DRUM_IDS = ["kick", "snare", "hihat", "openhat", "clap", "tom", "rimshot", "cowbell", "ride", "crash"] as const;
const MEL_IDS = ["piano", "guitar", "bass", "synth"] as const;
const NOTE_RE = /^[A-G][#b]?-?\d$/;

const SYSTEM = `You compose 16-step patterns for a music studio's beat maker.
Respond with ONLY a JSON object of this exact shape:
{
  "bpm": <integer 60-180>,
  "drums": { "kick":[16 booleans], "snare":[16 booleans], "hihat":[16 booleans], "openhat":[16 booleans], "clap":[16 booleans], "tom":[16 booleans], "rimshot":[16 booleans], "cowbell":[16 booleans], "ride":[16 booleans], "crash":[16 booleans] },
  "melodic": { "piano":[16 items], "guitar":[16 items], "bass":[16 items], "synth":[16 items] }
}
Rules:
- Each drum array has exactly 16 booleans; true = a hit on that 16th-note step (0,4,8,12 are downbeats).
- Each melodic array has exactly 16 items; each item is either a note name (e.g. "C3","E3","G2") or null (no note).
- Melodic tracks are monophonic (one note per step). Use bass in octaves 1-2, piano/synth 3-4, guitar 2-3.
- Make it groove and clearly match the requested genre, energy and tempo. Leave unused instruments as all-false / all-null.`;

const drumRow = (v: unknown) => Array.from({ length: 16 }, (_, i) => Boolean(Array.isArray(v) ? v[i] : false));
const melRow = (v: unknown) =>
  Array.from({ length: 16 }, (_, i) => {
    const n = Array.isArray(v) ? v[i] : null;
    return typeof n === "string" && NOTE_RE.test(n) ? n : null;
  });

// POST /api/studio/beats { description } → { bpm, drums, melodic }
export async function POST(req: Request) {
  if (!(await getUser())) return Response.json({ error: "Sign in to use the studio." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const description = String(body?.description || "").trim().slice(0, 500);
  if (!description) return Response.json({ error: "description is required" }, { status: 400 });

  const key = await secret("OPENAI_API_KEY");
  if (!key) {
    return Response.json(
      { error: "AI beats needs an OpenAI key.", hint: "An admin adds it in Admin > Settings > Integrations." },
      { status: 501 },
    );
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Create a beat: ${description}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
      }),
    });
    if (!res.ok) return Response.json({ error: "OpenAI request failed", detail: (await res.text()).slice(0, 400) }, { status: 502 });

    const data = await res.json();
    const raw = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    const bpm = Math.max(60, Math.min(180, Math.round(Number(raw.bpm) || 90)));
    const drums = Object.fromEntries(DRUM_IDS.map((id) => [id, drumRow(raw.drums?.[id])]));
    const melodic = Object.fromEntries(MEL_IDS.map((id) => [id, melRow(raw.melodic?.[id])]));

    return Response.json({ bpm, drums, melodic });
  } catch (e) {
    return Response.json({ error: "AI beats generation failed", detail: String(e) }, { status: 502 });
  }
}
