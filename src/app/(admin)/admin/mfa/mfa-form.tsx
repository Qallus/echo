"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Setup = { factorId: string; qr: string; secret: string };

// Verifies an existing authenticator factor, or enrolls one first (QR code +
// setup key). A verified code upgrades the session to aal2, which the
// database requires for every admin permission.
export function MfaForm() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setError(error.message); setLoading(false); return; }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) { setFactorId(verified.id); setLoading(false); return; }
      // Clear half-finished enrollments, then start a new one.
      for (const f of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const res = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Echo admin ${new Date().toISOString().slice(0, 10)}` });
      if (res.error) setError(res.error.message);
      else {
        setFactorId(res.data.id);
        setSetup({ factorId: res.data.id, qr: res.data.totp.qr_code, secret: res.data.totp.secret });
      }
      setLoading(false);
    })();
  }, []);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(undefined);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    if (error) {
      setError(error.message.includes("Invalid") ? "That code didn't work. Check the time on your phone and try the newest code." : error.message);
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  };

  if (loading) return <p className="flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></p>;

  return (
    <form onSubmit={verify} className="space-y-4">
      {setup && (
        <div className="space-y-3 rounded-xl border p-4 text-sm">
          <p className="font-medium">1. Scan this with your authenticator app</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL SVG from Supabase */}
          <img src={setup.qr} alt="Authenticator QR code" className="mx-auto size-44 rounded-lg bg-white p-2" />
          <p className="text-muted-foreground">Can&apos;t scan? Enter this key: <code className="break-all rounded bg-muted px-1 py-0.5 text-xs text-foreground">{setup.secret}</code></p>
          <p className="font-medium">2. Enter the 6-digit code it shows</p>
        </div>
      )}
      <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" autoFocus
        placeholder="123 456" maxLength={7} aria-label="Authentication code" className="text-center text-lg tracking-[0.3em]" />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || code.replace(/\s/g, "").length !== 6}>
        {busy && <Loader2 className="animate-spin" />} {setup ? "Turn on and continue" : "Verify"}
      </Button>
    </form>
  );
}
