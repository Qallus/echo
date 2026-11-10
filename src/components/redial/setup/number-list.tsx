"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput, formatPhone } from "@/components/ui/phone-input";

export const toE164 = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : raw.trim().startsWith("+") && d.length >= 8 ? `+${d}` : "";
};

// A short list of phone numbers (with optional names) to add and remove.
export function NumberList<T extends { number: string; label?: string }>({ items, onChange, max, named, placeholder, addLabel }: {
  items: T[]; onChange: (items: T[]) => void; max: number; named?: boolean; placeholder?: string; addLabel: string;
}) {
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const n = toE164(number);
    if (!n) return setError("Enter a full phone number.");
    if (named && !label.trim()) return setError("Add a name too.");
    if (items.some((i) => i.number === n)) return setError("That number is already on the list.");
    onChange([...items, { number: n, ...(named ? { label: label.trim() } : {}) } as T]);
    setNumber(""); setLabel(""); setError(null);
  };
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((i) => (
            <li key={i.number} className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pr-1 pl-3 text-sm">
              {i.label && <span className="font-medium">{i.label}</span>}<span className={i.label ? "text-muted-foreground" : ""}>{formatPhone(i.number)}</span>
              <button type="button" aria-label={`Remove ${formatPhone(i.number)}`} onClick={() => onChange(items.filter((x) => x.number !== i.number))}
                className="flex size-5 items-center justify-center rounded-full hover:bg-muted"><X className="size-3" /></button>
            </li>
          ))}
        </ul>
      )}
      {items.length < max && (
        <div className="flex flex-wrap gap-2">
          {named && <Input aria-label="Name" placeholder="Name, e.g. Sam (install crew)" maxLength={80} className="w-56" value={label} onChange={(e) => setLabel(e.target.value)} />}
          <PhoneInput aria-label="Phone number" placeholder={placeholder ?? "(480) 555-0142"} className="w-48" value={number} onChange={setNumber}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <Button type="button" variant="outline" onClick={add}><Plus /> {addLabel}</Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
