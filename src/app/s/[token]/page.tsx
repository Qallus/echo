import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedView } from "@/components/share/shared-view";
import { readShared } from "@/lib/share";
import { createClient } from "@/lib/supabase/server";

// A public share link. shared_link() returns only what the link shares, and
// nothing once it's revoked, expired or the recording is in the trash. The
// audio policy on storage allows the file only while a link includes it.

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

// Once per request, so the page and its metadata count as one view.
const load = cache(async (token: string) => {
  if (!TOKEN.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("shared_link", { p_token: token });
  const r = readShared(data);
  if (!r) return null;
  // Short-lived, so a revoked link's audio stops working soon after too.
  const audio = r.audioPath ? (await supabase.storage.from("recordings").createSignedUrl(r.audioPath, 60 * 60)).data?.signedUrl ?? null : null;
  return { r, audio };
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const shared = await load((await params).token);
  return {
    title: shared ? `${shared.r.title} · Echo` : "Link not available · Echo",
    robots: { index: false, follow: false },
    referrer: "no-referrer", // the token is in the URL; don't pass it on to other sites
  };
}

export default async function SharedLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const shared = await load((await params).token);
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2"><AudioLines className="size-4" /><span className="font-semibold tracking-[0.2em]">ECHO</span></Link>
          <Button size="sm" variant="outline" className="ml-auto" nativeButton={false} render={<Link href="/signup" />}>Try Echo free</Button>
        </div>
      </header>
      <main className="flex-1">
        {shared ? <SharedView r={shared.r} audioSrc={shared.audio} /> : (
          <div className="mx-auto max-w-md px-4 py-24 text-center">
            <h1 className="text-xl font-semibold">This link isn&apos;t available</h1>
            <p className="mt-2 text-sm text-muted-foreground">It may have been turned off or expired. Ask the person who shared it for a new link.</p>
          </div>
        )}
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Shared with <Link href="/" className="underline underline-offset-2">Echo</Link>: recordings, transcripts and summaries in one place.
      </footer>
    </div>
  );
}
