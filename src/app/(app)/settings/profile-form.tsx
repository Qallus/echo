"use client";

import { startTransition, useActionState, useState } from "react";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/types";
import { updateProfile, type SettingsState } from "./actions";
import { DetailsEditor } from "./details-editor";
import { Status } from "./settings-forms";
import { PhoneInput } from "@/components/ui/phone-input";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProfileForm({ profile, timeZones }: { profile: Profile; timeZones: string[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateProfile, {});
  const [tz, setTz] = useState(profile.timezone ?? "");
  // Browsers can report zones the server's list leaves out (e.g. "UTC", old aliases).
  const zones = tz && !timeZones.includes(tz) ? [tz, ...timeZones] : timeZones;

  return (
    // onSubmit, not action=: React resets action forms after submit, which
    // would blank the controlled time zone select.
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="full_name" label="Full name">
            <Input id="full_name" name="full_name" defaultValue={profile.fullName ?? ""} maxLength={100} required autoComplete="name" />
          </Field>
        </div>
        <Field id="job_title" label="Job title">
          <Input id="job_title" name="job_title" defaultValue={profile.jobTitle ?? ""} maxLength={100} autoComplete="organization-title" />
        </Field>
        <Field id="company" label="Company">
          <Input id="company" name="company" defaultValue={profile.company ?? ""} maxLength={120} autoComplete="organization" />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field id="email" label="Email" hint="Change it under Account.">
          <Input id="email" value={profile.email} disabled readOnly />
        </Field>
        <Field id="phone" label="Phone">
          <PhoneInput id="phone" name="phone" defaultValue={profile.phone ?? ""} maxLength={32} placeholder="(555) 123-4567" />
        </Field>
        <label className="flex items-start gap-3 rounded-lg border p-3 sm:col-span-2">
          <Switch name="phone_visible" defaultChecked={profile.phoneVisible} className="mt-0.5" />
          <span className="text-sm">
            <span className="font-medium">Show my phone number to teammates</span>
            <span className="block text-muted-foreground">Off: only you can see it. It&apos;s never shown on shared links.</span>
          </span>
        </label>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field id="timezone" label="Time zone" hint="Teammates see your local time.">
          <div className="flex gap-2">
            <Pick id="timezone" name="timezone" label="Time zone" value={tz} onChange={setTz}
              options={[{ value: "", label: "Not set" }, ...zones.map((z) => ({ value: z, label: z.replaceAll("_", " ") }))]} />
            <Button type="button" variant="outline" size="icon" aria-label="Use my time zone" title="Use my time zone"
              onClick={() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone)}><LocateFixed /></Button>
          </div>
        </Field>
        <Field id="location" label="Location">
          <Input id="location" name="location" defaultValue={profile.location ?? ""} maxLength={100} placeholder="City, country" />
        </Field>
        <Field id="website" label="Website">
          <Input id="website" name="website" defaultValue={profile.website ?? ""} maxLength={200} placeholder="example.com" autoComplete="url" />
        </Field>
        <Field id="linkedin" label="LinkedIn">
          <Input id="linkedin" name="linkedin" defaultValue={profile.linkedin ?? ""} maxLength={200} placeholder="linkedin.com/in/you" />
        </Field>
        <div className="sm:col-span-2">
          <Field id="bio" label="Bio" hint="A line or two about you and what you work on (500 characters).">
            <Textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={500} rows={3} />
          </Field>
        </div>
      </section>

      <section className="space-y-3 border-t pt-6">
        <div>
          <h3 className="text-sm font-medium">Additional information</h3>
          <p className="text-sm text-muted-foreground">Only you see these unless you turn on Teammates for a field.</p>
        </div>
        <DetailsEditor initial={profile.details} />
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
        <Status state={state} />
      </div>
    </form>
  );
}
