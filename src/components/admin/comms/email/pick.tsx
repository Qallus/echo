"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// A small single-choice dropdown on the app's Select (readable in dark mode,
// unlike the browser's native one).
export function Pick<T extends string>({ value, onChange, options, label, className, size = "sm" }: {
  value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; label: string; className?: string; size?: "sm" | "default";
}) {
  return (
    <Select items={options.map((o) => ({ value: o.value, label: o.label }))} value={value} onValueChange={(v) => v && onChange(v as T)}>
      <SelectTrigger size={size} aria-label={label} className={cn("w-full", className)}><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/[-_]/g, " ");
export const optionsOf = <T extends string>(values: readonly T[]) => values.map((v) => ({ value: v, label: cap(v) }));
