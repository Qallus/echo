"use client";

import { useRef, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// A multi-select field you can type in to search (shadcn's multiple combobox,
// on Base UI): picked options show as small chips inside the field. Options
// with a group are listed under that group's heading. With `create`, what you
// type can become an option of its own (a phone number that isn't a contact).

export type ComboOption = { value: string; label: string; count?: number; group?: string; hint?: string };
type ComboGroup = { value: string; items: ComboOption[] };

// Matches the label or the hint, as text or (for phone numbers) as digits.
const match = (o: ComboOption, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = `${o.label} ${o.hint ?? ""}`.toLowerCase();
  const digits = q.replace(/\D/g, "");
  return text.includes(q) || (digits.length >= 3 && `${o.value}${o.hint ?? ""}`.replace(/\D/g, "").includes(digits));
};

export function MultiCombobox({ options: base, value, onChange, placeholder = "Search…", empty = "Nothing matches.", label, className, create, autoFocus }: {
  options: ComboOption[]; value: string[]; onChange: (value: string[]) => void;
  placeholder?: string; empty?: string; label: string; className?: string;
  create?: (typed: string) => ComboOption | null; autoFocus?: boolean;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const made = create && typed.trim() ? create(typed.trim()) : null;
  const options = made && !base.some((o) => o.value === made.value) ? [made, ...base] : base;
  const picked = options.filter((o) => value.includes(o.value));
  const grouped = options.some((o) => o.group);
  const groups: ComboGroup[] = [];
  if (grouped) for (const o of options) {
    const name = o.group ?? "Other";
    const g = groups.find((x) => x.value === name);
    if (g) g.items.push(o); else groups.push({ value: name, items: [o] });
  }
  const item = (o: ComboOption) => (
    <Combobox.Item key={o.value} value={o}
      className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground">
      <span className="flex size-4 items-center justify-center"><Combobox.ItemIndicator><Check className="size-4" /></Combobox.ItemIndicator></span>
      <span className="min-w-0 flex-1 truncate">{o.label}{o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}</span>
      {o.count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{o.count}</span>}
    </Combobox.Item>
  );
  return (
    <Combobox.Root items={grouped ? groups : options} multiple onInputValueChange={(v) => setTyped(v)} filter={match} value={picked} onValueChange={(v: ComboOption[]) => onChange(v.map((o) => o.value))}
      itemToStringLabel={(o: ComboOption) => o.label} isItemEqualToValue={(a: ComboOption, b: ComboOption) => a.value === b.value}>
      <Combobox.Chips ref={anchor}
        className={cn("flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30", className)}>
        <Combobox.Value>
          {(items: ComboOption[]) => (
            <>
              {items.map((o) => (
                <Combobox.Chip key={o.value} aria-label={o.label} className="flex items-center gap-1 rounded-md bg-muted py-0.5 pr-0.5 pl-2 text-xs font-medium">
                  {o.label}
                  <Combobox.ChipRemove aria-label={`Remove ${o.label}`} className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"><X className="size-3" /></Combobox.ChipRemove>
                </Combobox.Chip>
              ))}
              <Combobox.Input aria-label={label} autoFocus={autoFocus} placeholder={items.length ? "" : placeholder}
                className="h-7 min-w-16 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground" />
            </>
          )}
        </Combobox.Value>
        {picked.length > 0 && (
          <Combobox.Clear aria-label="Clear all" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="size-4" /></Combobox.Clear>
        )}
        <Combobox.Trigger aria-label="Show options" className="rounded p-1 text-muted-foreground hover:text-foreground"><ChevronDown className="size-4" /></Combobox.Trigger>
      </Combobox.Chips>
      <Combobox.Portal>
        <Combobox.Positioner anchor={anchor} sideOffset={4} className="isolate z-50">
          <Combobox.Popup className="max-h-[min(var(--available-height),20rem)] w-(--anchor-width) overflow-y-auto overscroll-contain rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.Empty className="px-2 py-3 text-center text-muted-foreground empty:hidden">{empty}</Combobox.Empty>
            <Combobox.List>
              {grouped
                ? (g: ComboGroup) => (
                  <Combobox.Group key={g.value} items={g.items} className="not-first:mt-1 not-first:border-t not-first:pt-1">
                    <Combobox.GroupLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">{g.value}</Combobox.GroupLabel>
                    <Combobox.Collection>{item}</Combobox.Collection>
                  </Combobox.Group>
                )
                : item}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
