"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT } from "@/components/admin/crm/crm-ui";
import { saveOrganization } from "@/lib/admin/actions/settings";
import type { Organization } from "@/lib/settings/organization";

const ZONES = ["America/Phoenix", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu", "UTC", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Australia/Sydney"];

// Business details used in email footers ({{org_*}} merge fields) and the
// time zone for "today" on the dashboard, analytics and reports.
export function OrganizationForm({ initial, readOnly }: { initial: Organization; readOnly: boolean }) {
  const [o, setO] = useState(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const set = (patch: Partial<Organization>) => { setO((x) => ({ ...x, ...patch })); setMsg({}); };
  const field = (k: keyof Organization, label: string, hint?: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`org-${k}`}>{label}</Label>
      <Input id={`org-${k}`} type={type} value={o[k]} disabled={readOnly} onChange={(e) => set({ [k]: e.target.value })} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  const zones = ZONES.includes(o.timezone) ? ZONES : [o.timezone, ...ZONES];

  return (
    <form className="max-w-2xl space-y-5" onSubmit={(e) => { e.preventDefault(); start(async () => setMsg(await saveOrganization(o))); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Company name", "{{org_name}} in emails.")}
        {field("legalName", "Legal name")}
        {field("email", "Contact email", "{{org_email}}", "email")}
        {field("phone", "Phone", "{{org_phone}}", "tel")}
        <div className="sm:col-span-2">{field("address", "Mailing address", "{{org_address}}. Marketing emails must show a postal address (CAN-SPAM).")}</div>
        {field("website", "Website", "{{org_website}}")}
        <div className="space-y-1.5">
          <Label htmlFor="org-timezone">Time zone</Label>
          <select id="org-timezone" className={SELECT} value={o.timezone} disabled={readOnly} onChange={(e) => set({ timezone: e.target.value })}>
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">What &ldquo;today&rdquo; means on the dashboard, analytics and reports.</p>
        </div>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
        </div>
      )}
    </form>
  );
}
