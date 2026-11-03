"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")
const parse = (v: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v)
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null
}
export const formatTime = (v: string) => {
  const t = parse(v)
  if (!t) return ""
  return `${t.h % 12 || 12}:${pad(t.m)} ${t.h < 12 ? "AM" : "PM"}`
}

function Column({ items, selected, onPick, label }: { items: { value: number; label: string }[]; selected: number | null; onPick: (v: number) => void; label: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-selected=true]")?.scrollIntoView({ block: "center" })
  }, [])
  return (
    <div ref={ref} role="listbox" aria-label={label} className="flex max-h-56 flex-col gap-0.5 overflow-y-auto p-1 [scrollbar-width:thin]">
      {items.map((i) => (
        <button key={i.value} type="button" role="option" aria-selected={selected === i.value} data-selected={selected === i.value}
          onClick={() => onPick(i.value)}
          className={cn("h-8 min-w-11 rounded-md px-2 text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selected === i.value ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground")}>
          {i.label}
        </button>
      ))}
    </div>
  )
}

// Time field matching the DatePicker: a button that opens hour / minute /
// AM-PM columns. Works controlled (value + onChange) or in a form (name +
// defaultValue). The value is "HH:MM" in 24-hour time.
function TimePicker({ id, name, value, defaultValue, onChange, step = 5, placeholder = "Pick a time", disabled, className, "aria-label": ariaLabel }: {
  id?: string; name?: string; value?: string; defaultValue?: string | null; onChange?: (value: string) => void
  step?: number; placeholder?: string; disabled?: boolean; className?: string; "aria-label"?: string
}) {
  const [inner, setInner] = React.useState(defaultValue ?? "")
  const [open, setOpen] = React.useState(false)
  const current = value ?? inner
  const t = parse(current)
  const set = (h: number, m: number) => {
    const v = `${pad(h)}:${pad(m)}`
    if (value === undefined) setInner(v)
    onChange?.(v)
  }
  const h12 = t ? t.h % 12 || 12 : null
  const pm = t ? t.h >= 12 : false
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step)
  if (t && !minutes.includes(t.m)) minutes.push(t.m)
  minutes.sort((a, b) => a - b)
  const to24 = (hour12: number, isPm: boolean) => (hour12 % 12) + (isPm ? 12 : 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger id={id} disabled={disabled} aria-label={ariaLabel}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          !t && "text-muted-foreground", className
        )}>
        <Clock className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate tabular-nums">{t ? formatTime(current) : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1" align="start">
        <div className="flex divide-x">
          <Column label="Hour" selected={h12} onPick={(h) => set(to24(h, pm), t?.m ?? 0)}
            items={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} />
          <Column label="Minute" selected={t?.m ?? null} onPick={(m) => set(t?.h ?? 9, m)} items={minutes.map((m) => ({ value: m, label: pad(m) }))} />
          <Column label="AM or PM" selected={t ? (pm ? 1 : 0) : null} onPick={(v) => set(to24(h12 ?? 9, v === 1), t?.m ?? 0)}
            items={[{ value: 0, label: "AM" }, { value: 1, label: "PM" }]} />
        </div>
        <div className="flex justify-end border-t p-1">
          <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1 text-sm font-medium hover:bg-accent">Done</button>
        </div>
      </PopoverContent>
      {name && <input type="hidden" name={name} value={current} />}
    </Popover>
  )
}

export { TimePicker }
