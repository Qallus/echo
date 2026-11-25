"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

// "Download the desktop app": installs Redial as an app (PWA) where the
// browser offers it (Chrome, Edge, Android); on Safari and iPhone it explains
// Add to Home Screen / Add to Dock.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const isApple = () => /iPhone|iPad|Macintosh/.test(navigator.userAgent) && !/Chrome|Edg/.test(navigator.userAgent);
const noop = () => () => {};

export function InstallAppButton({ className }: { className?: string }) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);
  const [help, setHelp] = useState(false);
  const installed = useSyncExternalStore(noop, standalone, () => false);
  const apple = useSyncExternalStore(noop, isApple, () => false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    const onInstalled = () => setDone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (installed || done) return <Button variant="outline" size="sm" disabled className={className}><Check /> Installed</Button>;
  const install = async () => {
    if (!event) { setHelp((h) => !h); return; }
    await event.prompt();
    if ((await event.userChoice).outcome === "accepted") setDone(true);
    setEvent(null);
  };
  return (
    <div className={className}>
      <Button variant="outline" size="sm" onClick={install}><Monitor /> Install</Button>
      {help && (
        <p className="mt-2 text-xs text-muted-foreground">
          {apple
            ? "Safari: tap Share, then Add to Home Screen (iPhone), or File, then Add to Dock (Mac)."
            : "In Chrome or Edge, open the browser menu and choose Install Redial (or Cast, save and share, then Install page as app)."}
        </p>
      )}
    </div>
  );
}
