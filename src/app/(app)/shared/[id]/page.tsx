import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedView } from "@/components/share/shared-view";
import { isUuid, requireUser } from "@/lib/data";
import { readShared } from "@/lib/share";
import { audioUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Shared recording · Echo" };

// One recording shared with you: everything, read-only.
export default async function SharedRecordingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("shared_recording", { rec: id });
  const r = readShared(data);
  if (!r) notFound();
  const src = await audioUrl(supabase, r.audioPath);
  return (
    <div>
      <div className="border-b px-4 py-2.5 sm:px-6">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/shared" />}><ArrowLeft /> Shared with me</Button>
      </div>
      <SharedView r={r} audioSrc={src} />
    </div>
  );
}
