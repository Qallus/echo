"use client";

import { useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { registerForEvent } from "../../actions";

export function RegisterForm({ slug, title, maxGuests }: { slug: string; title: string; maxGuests: number }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", guests: 1, website: "" });
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border p-6 text-center">
        <CalendarCheck className="size-8 text-emerald-600" />
        <p className="font-medium">{done === "already" ? "You're already registered" : "You're registered"}</p>
        <p className="text-sm text-muted-foreground">We&apos;ll email you a reminder the day before {title}.</p>
      </div>
    );
  }
  return (
    <form className="space-y-3 rounded-2xl border p-5" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { const r = await registerForEvent({ slug, ...f }); if (r.error) setError(r.error); else setDone(r.ok ?? "registered"); });
    }}>
      <p className="font-medium">Register</p>
      <div className="space-y-1.5"><Label htmlFor="r-name">Name</Label><Input id="r-name" required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="r-email">Email</Label><Input id="r-email" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="r-phone">Phone (optional)</Label><PhoneInput id="r-phone" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></div>
      <div className="space-y-1.5"><Label htmlFor="r-company">Company (optional)</Label><Input id="r-company" autoComplete="organization" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></div>
      {maxGuests > 1 && (
        <div className="space-y-1.5"><Label htmlFor="r-guests">People coming (including you)</Label>
          <Input id="r-guests" type="number" min={1} max={maxGuests} value={f.guests} onChange={(e) => setF({ ...f, guests: Number(e.target.value) })} />
        </div>
      )}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Registering…" : "Register"}</Button>
    </form>
  );
}
