"use client";

import { useState } from "react";
import { ChevronDown, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// An action on the selected rows: a plain button, a menu of values
// (stage, role, owner…), or a short text input (tags).
export type BulkAction = {
  label: string; icon: LucideIcon; destructive?: boolean;
  run?: () => void;
  options?: { value: string; label: string }[]; onPick?: (value: string) => void;
  input?: { placeholder: string; submit: string; onSubmit: (value: string) => void };
};

function InputAction({ a, disabled }: { a: BulkAction & { input: NonNullable<BulkAction["input"]> }; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="sm" variant="outline" disabled={disabled} />}><a.icon /> {a.label}</PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (!value.trim()) return; a.input.onSubmit(value); setValue(""); setOpen(false); }}>
          <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={a.input.placeholder} aria-label={a.label} />
          <Button type="submit" size="sm" className="w-full" disabled={!value.trim()}>{a.input.submit}</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

// Shown while rows are selected: the count, then the actions.
export function BulkBar({ count, total, actions, onSelectAll, onClear, pending }: {
  count: number; total: number; actions: BulkAction[]; onSelectAll: () => void; onClear: () => void; pending?: boolean;
}) {
  if (!count) return null;
  return (
    <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-2 pl-3 text-sm shadow-sm backdrop-blur md:top-2">
      <span className="font-medium">{count} selected</span>
      {count < total && <Button size="sm" variant="link" className="px-1" onClick={onSelectAll}>Select all {total}</Button>}
      <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
      {actions.map((a) => a.options ? (
        <DropdownMenu key={a.label}>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={pending} />}><a.icon /> {a.label} <ChevronDown className="opacity-60" /></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-52">
            {a.options.map((o) => <DropdownMenuItem key={o.value} onClick={() => a.onPick?.(o.value)}>{o.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : a.input ? (
        <InputAction key={a.label} a={a as BulkAction & { input: NonNullable<BulkAction["input"]> }} disabled={pending} />
      ) : (
        <Button key={a.label} size="sm" variant={a.destructive ? "destructive" : "outline"} disabled={pending} onClick={a.run}><a.icon /> {a.label}</Button>
      ))}
      <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Clear selection" onClick={onClear}><X /></Button>
    </div>
  );
}

// Opens the email app with everyone selected in Bcc (sending from Echo comes
// with Communications). Returns how many had no address.
export function emailEveryone(emails: (string | null)[]) {
  const list = [...new Set(emails.filter((e): e is string => Boolean(e)))];
  if (list.length) window.location.href = `mailto:?bcc=${list.map(encodeURIComponent).join(",")}`;
  return emails.length - list.length;
}
