"use client";

import { useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// A single-choice dropdown on the design-system Select (follows light and
// dark mode, unlike the browser's native select). An option with value ""
// is a real choice ("Not connected", "A phone number"); options with a
// `group` are listed under that heading. Controlled (`value` + `onChange`)
// or uncontrolled (`defaultValue`); with `name` it posts in a form like a
// native select.

export type PickOption = { value: string; label: string; disabled?: boolean; group?: string };
const NONE = "__none__";

export function Pick({ value, defaultValue, onChange, options, label, name, id, disabled, required, className, size = "default" }: {
  value?: string; defaultValue?: string; onChange?: (v: string) => void; options: readonly PickOption[]; label: string;
  name?: string; id?: string; disabled?: boolean; required?: boolean; className?: string; size?: "sm" | "default";
}) {
  const [own, setOwn] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? own;
  const items = options.map((o) => ({ value: o.value || NONE, label: o.label }));
  const groups = [...new Set(options.map((o) => o.group ?? ""))];
  const item = (o: PickOption) => <SelectItem key={o.value || NONE} value={o.value || NONE} disabled={o.disabled}>{o.label}</SelectItem>;
  const change = (v: unknown) => {
    const next = !v || v === NONE ? "" : String(v);
    if (value === undefined) setOwn(next);
    onChange?.(next);
  };
  return (
    <>
      <Select items={items} value={current || NONE} onValueChange={change} disabled={disabled}>
        <SelectTrigger id={id} size={size} aria-label={label} aria-required={required || undefined} className={cn("w-full min-w-0", className)}><SelectValue /></SelectTrigger>
        <SelectContent>
          {groups.length > 1 || groups[0]
            ? groups.map((g) => (
              <SelectGroup key={g || "_"}>
                {g && <SelectLabel>{g}</SelectLabel>}
                {options.filter((o) => (o.group ?? "") === g).map(item)}
              </SelectGroup>
            ))
            : options.map(item)}
        </SelectContent>
      </Select>
      {name && <input type="hidden" name={name} value={current} />}
    </>
  );
}
