"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Maximize2, Minimize2, X } from "lucide-react"
import { cn } from "@/lib/utils"

// A centered dialog for short forms and confirms. Drag the bottom-right corner
// to resize it (when `resizable`), or use the maximize button to fill the
// screen. Bigger work belongs in ResponsivePanel (side sheet / bottom sheet).

const iconButton = "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"

export function ResizableDialog({ open, onOpenChange, title, description, footer, children, resizable = true, className }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  resizable?: boolean
  className?: string
}) {
  const [max, setMax] = React.useState(false)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) setMax(false); onOpenChange(o) }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background shadow-lg outline-none transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            max ? "h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)]" : "max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]",
            resizable && !max && "min-h-48 min-w-72 resize",
            className,
          )}
        >
          <div className="flex shrink-0 items-start gap-2 px-6 pt-5 pb-3">
            <div className="min-w-0 flex-1 space-y-1">
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description>}
            </div>
            {resizable && (
              <button type="button" className={iconButton} onClick={() => setMax((m) => !m)} aria-label={max ? "Restore size" : "Maximize"} title={max ? "Restore size" : "Maximize"}>
                {max ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            )}
            <DialogPrimitive.Close aria-label="Close" className={iconButton}><X className="size-4" /></DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5">{children}</div>
          {footer && <div className="shrink-0 border-t px-6 py-3">{footer}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
