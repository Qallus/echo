import { AudioWaveform } from "lucide-react";
import { StudioView } from "@/components/studio/studio-view";
import { requireUser } from "@/lib/data";
import { myStudioAudio } from "@/lib/studio/data";

export const metadata = { title: "Studio · Echo" };

// Recording Studio: greetings, extension prompts, phone menus and hold
// messages, recorded, uploaded or made with an AI voice, with music.
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser();
  const [{ tab }, items] = await Promise.all([searchParams, myStudioAudio()]);
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><AudioWaveform className="size-7" /> Recording Studio</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Record greetings, extension prompts and phone menus. Use your own voice, an upload, or an AI voice, then add music.
        </p>
      </div>
      <StudioView items={items} initialTab={tab === "studio" ? "studio" : "library"} />
    </div>
  );
}
