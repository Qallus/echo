"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { createShortLink } from "@/lib/admin/actions/analytics";

const MEDIUMS = [
  { value: "social", label: "Social post" }, { value: "email", label: "Email" }, { value: "sms", label: "Text message" },
  { value: "cpc", label: "Paid ad" }, { value: "card", label: "Business card / QR" }, { value: "partner", label: "Partner or affiliate" }, { value: "referral", label: "Other website" },
];

// Build a tagged link for anything posted by hand, so Analytics credits it.
// "Short link" makes a redial.si/l/… link that also counts clicks (for texts).
export function LinkBuilder() {
  const [url, setUrl] = useState("https://redial.si/");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [short, setShort] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  let built = "";
  try {
    const u = new URL(url);
    if (source) u.searchParams.set("utm_source", source.trim().toLowerCase());
    u.searchParams.set("utm_medium", medium);
    if (campaign) u.searchParams.set("utm_campaign", campaign.trim().toLowerCase().replace(/\s+/g, "-"));
    built = u.toString();
  } catch { built = ""; }
  const copy = (s: string) => { void navigator.clipboard.writeText(s); setCopied(s); setTimeout(() => setCopied(null), 1500); };

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Link2 className="size-4" /> Campaign link builder</h3>
      <p className="text-xs text-muted-foreground">For posts, ads, cards and anything sent outside Redial. Emails sent from Redial are tagged automatically.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="lb-url">Page</Label><Input id="lb-url" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="lb-medium">Where it&apos;s posted</Label><Pick id="lb-medium" label="Where it's posted" value={medium} onChange={setMedium} options={MEDIUMS} /></div>
        <div className="space-y-1.5"><Label htmlFor="lb-source">Source</Label><Input id="lb-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="linkedin, facebook, nextdoor" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="lb-campaign">Campaign name</Label><Input id="lb-campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="e.g. november-scam-week" /></div>
      </div>
      {built && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{built}</code>
            <Button size="sm" variant="outline" onClick={() => copy(built)}>{copied === built ? <Check /> : <Copy />} Copy</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
              setError(undefined);
              const r = await createShortLink(built, medium === "cpc" ? "ads" : (["sms", "email", "social", "card", "partner"].includes(medium) ? medium : "campaign"), campaign || null);
              if (r.error) setError(r.error); else setShort(r.url);
            })}>Short link</Button>
          </div>
          {short && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-2">
              <code className="min-w-0 flex-1 truncate text-xs">{short}</code>
              <Button size="sm" variant="outline" onClick={() => copy(short)}>{copied === short ? <Check /> : <Copy />} Copy</Button>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </section>
  );
}
