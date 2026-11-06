"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  ACCOUNT_TYPES, CONTACT_ROLES, CONTACT_STATUSES, LEAD_STATUSES, PLANS, SOURCES, WAITLIST_PRODUCTS, WAITLIST_STATUSES, WAITLIST_TOPICS, type Audience,
} from "@/lib/comms/audience";
import { cn } from "@/lib/utils";
import { cap } from "./pick";

const EMPTY: Record<Audience["source"], Audience> = {
  contacts: { source: "contacts" }, waitlist: { source: "waitlist" }, customers: { source: "customers" },
};

// Toggle chips: none picked means "any".
function Chips({ label, values, picked = [], onChange }: { label: string; values: readonly string[]; picked?: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label} <span className="opacity-70">· {picked.length ? `${picked.length} picked` : "any"}</span></p>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => {
          const on = picked.includes(v);
          return (
            <button key={v} type="button" aria-pressed={on} onClick={() => onChange(on ? picked.filter((x) => x !== v) : [...picked, v])}
              className={cn("rounded-full border px-2.5 py-1 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              {cap(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Tags({ tags = [], known, mode, onChange, onMode }: { tags?: string[]; known: string[]; mode: "any" | "all"; onChange: (t: string[]) => void; onMode: (m: "any" | "all") => void }) {
  const [draft, setDraft] = useState("");
  const add = (t: string) => { const v = t.trim(); if (v && !tags.includes(v)) onChange([...tags, v]); setDraft(""); };
  const suggestions = known.filter((k) => !tags.includes(k) && k.toLowerCase().includes(draft.toLowerCase())).slice(0, 8);
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        Tags · {tags.length > 1 ? (
          <button type="button" className="underline underline-offset-2" onClick={() => onMode(mode === "any" ? "all" : "any")}>{mode === "any" ? "any of these" : "all of these"}</button>
        ) : tags.length ? "has this tag" : "any"}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">{t}
            <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}><X className="size-3" /></button></span>
        ))}
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); } }}
          placeholder="Add a tag" aria-label="Add a tag" className="h-7 w-32 text-xs" />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">+ {s}</button>)}
        </div>
      )}
    </div>
  );
}

// Pick a source, then narrow it down. `knownTags` comes from the CRM.
export function AudienceBuilder({ value, onChange, knownTags, canCustomers }: {
  value: Audience; onChange: (a: Audience) => void; knownTags: string[]; canCustomers: boolean;
}) {
  const sources = SOURCES.filter((s) => s.id !== "customers" || canCustomers);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {sources.map((s) => (
          <button key={s.id} type="button" aria-pressed={value.source === s.id} onClick={() => value.source !== s.id && onChange(EMPTY[s.id])}
            className={cn("rounded-lg border p-2.5 text-left", value.source === s.id ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
            <span className="block text-sm font-medium">{s.label}</span>
            <span className="block text-xs text-muted-foreground">{s.detail}</span>
          </button>
        ))}
      </div>
      {value.source === "contacts" && <>
        <Chips label="Role" values={CONTACT_ROLES} picked={value.roles} onChange={(roles) => onChange({ ...value, roles })} />
        <Chips label="Lead status" values={LEAD_STATUSES} picked={value.leadStatuses} onChange={(leadStatuses) => onChange({ ...value, leadStatuses })} />
        <Chips label="Status" values={CONTACT_STATUSES} picked={value.statuses} onChange={(statuses) => onChange({ ...value, statuses })} />
        <Tags tags={value.tags} known={knownTags} mode={value.tagMode ?? "any"} onChange={(tags) => onChange({ ...value, tags })} onMode={(tagMode) => onChange({ ...value, tagMode })} />
      </>}
      {value.source === "waitlist" && <>
        <Chips label="Interested in" values={WAITLIST_PRODUCTS} picked={value.products} onChange={(products) => onChange({ ...value, products })} />
        <Chips label="Wants updates about" values={WAITLIST_TOPICS} picked={value.topics} onChange={(topics) => onChange({ ...value, topics })} />
        <Chips label="Status" values={WAITLIST_STATUSES} picked={value.statuses} onChange={(statuses) => onChange({ ...value, statuses })} />
      </>}
      {value.source === "customers" && <>
        <Chips label="Account" values={ACCOUNT_TYPES} picked={value.accountTypes} onChange={(accountTypes) => onChange({ ...value, accountTypes })} />
        <Chips label="Plan" values={PLANS} picked={value.plans} onChange={(plans) => onChange({ ...value, plans })} />
      </>}
    </div>
  );
}
