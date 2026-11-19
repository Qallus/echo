import { AudioWaveform } from "lucide-react";
import { StudioView } from "@/components/studio/studio-view";
import { requireUser } from "@/lib/data";
import { myStudioAudio } from "@/lib/studio/data";

export const metadata = { title: "Recording Studio · Redial" };

// Recording Studio: greetings, extension prompts, phone menus and hold
// messages, recorded, uploaded or made with an AI voice, with music.
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ tab?: string; script?: string; kind?: string; name?: string; extension?: string }> }) {
  await requireUser();
  const [sp, items] = await Promise.all([searchParams, myStudioAudio()]);
  const { tab } = sp;
  const cut = (v: string | undefined, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
  const prefill = sp.script ? { script: cut(sp.script, 2000), kind: cut(sp.kind, 20), name: cut(sp.name, 120), extension: cut(sp.extension, 40) } : undefined;
  return (
    <div className="w-full space-y-6 py-8 px-4 sm:px-6 lg:px-8 2xl:px-10">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><AudioWaveform className="size-7" /> Recording Studio</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Greetings, phone menus, extension and hold messages for your phone line. Make one with an AI voice in four steps, or record your own and add music.
        </p>
      </div>
      <StudioView items={items} initialTab={tab === "studio" || prefill ? "studio" : "library"} prefill={prefill} />
    </div>
  );
}
