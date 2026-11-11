"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { Switch } from "@/components/ui/switch";
import { DETAIL_ICONS } from "@/components/profile/detail-icons";
import { DETAIL_KINDS, MAX_DETAILS, MAX_VALUE, PREFIXES, type DetailKind, type ProfileDetail } from "@/lib/profile-details";

// "Additional information": rows the user adds from a menu. Sent with the
// profile form as JSON in a hidden "details" input.
export function DetailsEditor({ initial }: { initial: ProfileDetail[] }) {
  const [rows, setRows] = useState(initial);
  const update = (i: number, patch: Partial<ProfileDetail>) => setRows((r) => r.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const add = (kind: DetailKind) => {
    const k = DETAIL_KINDS.find((x) => x.kind === kind)!;
    // Prefix goes first; it reads as part of the name.
    const row = { kind, label: k.label, value: kind === "prefix" ? PREFIXES[0] : "", shared: kind === "prefix" };
    setRows((r) => (kind === "prefix" ? [row, ...r] : [...r, row]));
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name="details" value={JSON.stringify(rows)} />
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Add a prefix, more phone numbers or emails, an address or your own fields.</p>}
      {rows.map((d, i) => {
        const k = DETAIL_KINDS.find((x) => x.kind === d.kind)!;
        const Icon = DETAIL_ICONS[d.kind];
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 sm:flex-nowrap">
            <Icon className="ml-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            {d.kind === "prefix" || d.kind === "birthday" ? (
              <span className="w-28 shrink-0 text-sm font-medium sm:w-32">{k.label}</span>
            ) : (
              <Input aria-label="Field name" value={d.label} maxLength={40} placeholder={d.kind === "other" ? "Field name" : "Label"}
                onChange={(e) => update(i, { label: e.target.value })} className="w-28 shrink-0 sm:w-32" />
            )}
            <div className="min-w-0 flex-1 basis-40">
              {d.kind === "prefix" ? (
                <Pick label="Prefix" value={d.value} onChange={(v) => update(i, { value: v })}
                  options={PREFIXES.map((p) => ({ value: p, label: p }))} />
              ) : (
                <Input aria-label={d.label || k.label} value={d.value} placeholder={k.placeholder} maxLength={MAX_VALUE[d.kind] ?? 120}
                  type={d.kind === "birthday" ? "date" : d.kind === "email" ? "email" : d.kind === "phone" ? "tel" : "text"}
                  onChange={(e) => update(i, { value: e.target.value })} />
              )}
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground" title="Show this to teammates">
              <Switch size="sm" checked={d.shared} onCheckedChange={(shared) => update(i, { shared })} />
              Teammates
            </label>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${d.label || k.label}`}
              onClick={() => setRows((r) => r.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" disabled={rows.length >= MAX_DETAILS} />}>
          <Plus /> Add field
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {DETAIL_KINDS.map((k) => {
            const Icon = DETAIL_ICONS[k.kind];
            return (
              <DropdownMenuItem key={k.kind} disabled={k.single && rows.some((r) => r.kind === k.kind)} onClick={() => add(k.kind)}>
                <Icon /> {k.name}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
