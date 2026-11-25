"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/utils"

// shadcn-style slider on Base UI: one thumb, a filled track.
function Slider({ value, onValueChange, min = 0, max = 100, step = 1, className, "aria-label": ariaLabel }: {
  value: number; onValueChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string; "aria-label"?: string
}) {
  return (
    <SliderPrimitive.Root value={value} onValueChange={(v) => onValueChange(Array.isArray(v) ? v[0] : v)} min={min} max={max} step={step}
      className={cn("relative flex w-full touch-none items-center select-none", className)}>
      <SliderPrimitive.Control className="flex h-5 w-full items-center">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Indicator className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb aria-label={ariaLabel}
          className="block size-4 rounded-full border-2 border-primary bg-background shadow transition-[box-shadow] focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
