"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { cap } from "./pick";

export type PickerTemplate = { id: string; name: string; subject: string; category: string; status: string };

// The Templates button beside the subject: search, category chips, and
// "No template" to write a message instead. Archived templates are hidden.
export function TemplatePicker({ templates, value, onChange, className }: {
  templates: PickerTemplate[]; value: string | null; onChange: (t: PickerTemplate | null) => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const usable = templates.filter((t) => t.status !== "archived");
  const cats = useMemo(() => [...new Set(usable.map((t) => t.category))].sort(), [usable]);
  const shown = usable.filter((t) => (!cat || t.category === cat) && `${t.name} ${t.subject}`.toLowerCase().includes(q.trim().toLowerCase()));
  const current = templates.find((t) => t.id === value);
  const choose = (t: PickerTemplate | null) => { onChange(t); setOpen(false); setQ(""); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className={cn("justify-between gap-2", className)} />}>
        <FileText className="text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">{current ? current.name : "Templates"}</span>
        <ChevronDown className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" aria-label="Search templates"
              className="h-8 w-full rounded-md bg-transparent pl-7 text-sm outline-none" />
          </div>
          {cats.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {[null, ...cats].map((c) => (
                <button key={c ?? "all"} type="button" onClick={() => setCat(c)}
                  className={cn("rounded-full border px-2 py-0.5 text-[11px]", cat === c ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {c ? `${cap(c)} ${usable.filter((t) => t.category === c).length}` : `All ${usable.length}`}
                </button>
              ))}
            </div>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto p-1" role="listbox" aria-label="Templates">
          <li>
            <button type="button" onClick={() => choose(null)} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent">
              <span className="flex-1">No template <span className="text-muted-foreground">(write a message)</span></span>{!value && <Check className="size-4" />}
            </button>
          </li>
          {shown.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => choose(t)} className="flex w-full items-start gap-2 rounded px-2 py-2 text-left hover:bg-accent">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{t.name}</span>
                    {t.status === "draft" && <span className="rounded border px-1 text-[10px] font-normal text-muted-foreground">Draft</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{t.subject || "No subject"}</span>
                </span>
                {value === t.id && <Check className="mt-0.5 size-4" />}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No templates match.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
