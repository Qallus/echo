"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, LogIn, UserPlus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Platform } from "@/lib/waitlist-options";
import { cn } from "@/lib/utils";
import { WaitlistForm } from "./waitlist-form";

// App Store and Google Play buttons for the Redial mobile app (Echo is inside it). Until the
// store listings are live they open a window: set up an account, sign in, or
// get notified (the waitlist form). When a listing is live, pass its URL in
// STORE_URLS and that button links straight to the store.
const STORE_URLS: Record<Platform, string | null> = { ios: null, android: null };

export function AppBadges({ source, signedIn = false, className }: { source: string; signedIn?: boolean; className?: string }) {
  const [open, setOpen] = useState<Platform | null>(null);
  const [view, setView] = useState<"choose" | "notify">("choose");
  const show = (p: Platform) => { setView("choose"); setOpen(p); };
  const name = open === "android" ? "Android" : "iPhone";

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <Badge platform="ios" onOpen={show} />
        <Badge platform="android" onOpen={show} />
      </div>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto" title={view === "notify" ? `Get notified about Redial for ${name}` : `Redial for ${name}`}
            description={view === "notify" ? "We'll let you know the moment it's ready, and only contact you the ways you choose." : "The Redial app, with Echo inside, is on its way. Your account works on the web today and in the app when it arrives."}>
            {view === "choose" ? (
              <div className="grid gap-2">
                {!signedIn && (
                  <Option href="/signup" icon={<UserPlus />} title="Set up your account" detail="Start on the web now; sign in to the app with the same account later." />
                )}
                <Option href={signedIn ? "/" : "/login"} icon={<LogIn />} title={signedIn ? "Open Echo" : "Sign in"} detail={signedIn ? "You're signed in. Use Echo on the web." : "Already have an account? Use Echo on the web."} />
                <button type="button" onClick={() => setView("notify")} className="flex items-start gap-3 rounded-xl border p-4 text-left hover:bg-muted/60 [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0">
                  <BellRing />
                  <span><span className="block font-medium">Get notified</span><span className="block text-sm text-muted-foreground">Join the list and hear first when the app is ready.</span></span>
                </button>
              </div>
            ) : (
              <WaitlistForm platform={open} source={source} onBack={() => setView("choose")} />
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function Option({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-xl border p-4 hover:bg-muted/60 [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0">
      {icon}<span><span className="block font-medium">{title}</span><span className="block text-sm text-muted-foreground">{detail}</span></span>
    </Link>
  );
}

// Store-style badge: black, logo, two lines. A real link once the listing exists.
function Badge({ platform, onOpen }: { platform: Platform; onOpen: (p: Platform) => void }) {
  const ios = platform === "ios";
  const inner = (
    <>
      {ios ? <AppleLogo /> : <PlayLogo />}
      <span className="text-left leading-tight">
        <span className="block text-[10px] font-normal opacity-80">{ios ? "Redial for iPhone" : "Redial for Android"}</span>
        <span className="block text-base font-semibold tracking-tight">{ios ? "App Store" : "Google Play"}</span>
      </span>
    </>
  );
  const style = "inline-flex h-12 min-w-40 items-center gap-2.5 rounded-xl border border-white/15 bg-black px-3.5 text-white shadow-sm transition hover:bg-neutral-800 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
  const url = STORE_URLS[platform];
  if (url) return <a href={url} className={style} target="_blank" rel="noopener noreferrer">{inner}</a>;
  return <button type="button" className={style} onClick={() => onOpen(platform)} aria-haspopup="dialog">{inner}</button>;
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6 fill-current">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function PlayLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6">
      <path fill="#00D7FE" d="M1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924z" />
      <path fill="#00F076" d="M13.544 10.989l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973z" />
      <path fill="#FFC900" d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z" />
      <path fill="#FF3A44" d="M13.544 13.056l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
    </svg>
  );
}
