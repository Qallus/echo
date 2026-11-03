"use client"

import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// "YYYY-MM-DD" <-> local Date, with no time-zone shift.
const toDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : undefined)
const toValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

// Years offered in the month/year dropdowns.
const START = new Date(2015, 0)
const END = new Date(2045, 11)

// Date field on the shadcn Calendar. Works controlled (value + onChange) or
// inside a form (name + defaultValue, submitted as YYYY-MM-DD).
function DatePicker({ id, name, value, defaultValue, onChange, placeholder = "Pick a date", className }: {
  id?: string; name?: string; value?: string; defaultValue?: string | null; onChange?: (value: string) => void
  placeholder?: string; className?: string
}) {
  const [inner, setInner] = React.useState(defaultValue ?? "")
  const [open, setOpen] = React.useState(false)
  const current = value ?? inner
  const date = toDate(current)
  const set = (v: string) => { if (value === undefined) setInner(v); onChange?.(v) }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger
          id={id}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : placeholder}</span>
        </PopoverTrigger>
        {date && (
          <button type="button" aria-label="Clear date" onClick={() => set("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} defaultMonth={date} captionLayout="dropdown" startMonth={START} endMonth={END}
          onSelect={(d) => { set(d ? toValue(d) : ""); setOpen(false) }} />
      </PopoverContent>
      {name && <input type="hidden" name={name} value={current} />}
    </Popover>
  )
}

export { DatePicker }
