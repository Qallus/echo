"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { Maximize2, Minimize2, X } from "lucide-react"
import { cn } from "@/lib/utils"

// A panel for anything bigger than a quick confirm (memory ui-sheets-over-modals):
//  * desktop (md and up): a side sheet from the right. Drag its left edge to
//    resize it (the width is remembered per `id` in this browser), or use the
//    expand button to make it wide;
//  * phones: a bottom sheet with a grab handle that snaps between most of the
//    screen and full height, and closes when swiped down.
// Title, description, header actions, a scrolling body and a sticky footer.
// Focus is trapped while open and Esc closes it (Base UI Dialog / Drawer).

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  /** Buttons shown next to the title (e.g. an "Open" link). */
  actions?: React.ReactNode
  /** Sticky at the bottom (Save / Cancel). */
  footer?: React.ReactNode
  children: React.ReactNode
  /** Remembers this panel's width; panels without one share a default. */
  id?: string
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  className?: string
  bodyClassName?: string
  /** Phones: open at full height (a chat or a long form), not most of the screen. */
  fullHeight?: boolean
}

const DESKTOP = "(min-width: 48rem)"
const subscribeMedia = (fn: () => void) => {
  const m = window.matchMedia(DESKTOP)
  m.addEventListener("change", fn)
  return () => m.removeEventListener("change", fn)
}
function useDesktop() {
  return React.useSyncExternalStore(subscribeMedia, () => window.matchMedia(DESKTOP).matches, () => true)
}

const widthKey = (id?: string) => `redial.panel-width.${id ?? "default"}`
function readWidth(id: string | undefined, fallback: number) {
  try {
    const n = Number(localStorage.getItem(widthKey(id)))
    return Number.isFinite(n) && n > 0 ? n : fallback
  } catch {
    return fallback
  }
}
function saveWidth(id: string | undefined, width: number) {
  try { localStorage.setItem(widthKey(id), String(Math.round(width))) } catch {}
}

export function ResponsivePanel(props: Props) {
  const desktop = useDesktop()
  return desktop ? <SidePanel {...props} /> : <BottomPanel {...props} />
}

function Header({ title, description, actions, close, extra }: {
  title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; close: React.ReactNode; extra?: React.ReactNode
}) {
  return (
    <div className="flex shrink-0 items-start gap-2 border-b px-5 py-4">
      <div className="min-w-0 flex-1 space-y-1">{title}{description}</div>
      <div className="flex shrink-0 items-center gap-1">{actions}{extra}{close}</div>
    </div>
  )
}

const iconButton = "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"

function SidePanel({ open, onOpenChange, title, description, actions, footer, children, id, defaultWidth = 520, minWidth = 380, maxWidth = 1200, className, bodyClassName }: Props) {
  const [width, setWidth] = React.useState(() => (typeof window === "undefined" ? defaultWidth : readWidth(id, defaultWidth)))
  const [wide, setWide] = React.useState(false)
  const limit = React.useCallback((w: number) => Math.min(Math.max(w, minWidth), Math.min(maxWidth, window.innerWidth - 32)), [minWidth, maxWidth])

  // Drag the left edge to resize; the arrow keys work on the edge too.
  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    setWide(false)
    const move = (ev: PointerEvent) => setWidth(limit(window.innerWidth - ev.clientX))
    const up = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      setWidth((w) => { saveWidth(id, w); return w })
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
  }
  const nudge = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    setWide(false)
    setWidth((w) => { const next = limit(w + (e.key === "ArrowLeft" ? 40 : -40)); saveWidth(id, next); return next })
  }
  const shown = wide ? Math.min(maxWidth, typeof window === "undefined" ? maxWidth : window.innerWidth - 32) : width

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-[2px]" />
        <DialogPrimitive.Popup
          style={{ width: shown }}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex max-w-[calc(100vw-2rem)] flex-col border-l bg-popover text-sm text-popover-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 ease-out data-ending-style:translate-x-8 data-ending-style:opacity-0 data-starting-style:translate-x-8 data-starting-style:opacity-0",
            className,
          )}
        >
          <div role="separator" aria-orientation="vertical" aria-label="Resize panel (arrow keys)" tabIndex={0}
            onPointerDown={startDrag} onKeyDown={nudge} onDoubleClick={() => { setWide(false); setWidth(defaultWidth); saveWidth(id, defaultWidth) }}
            className="group absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize touch-none focus-visible:outline-none">
            <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover:bg-primary/40 group-focus-visible:bg-primary/60 group-active:bg-primary/60" />
            <span className="absolute top-1/2 left-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border group-hover:bg-primary/50" />
          </div>
          <Header
            title={<DialogPrimitive.Title className="truncate text-base font-semibold">{title}</DialogPrimitive.Title>}
            description={description ? <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description> : null}
            actions={actions}
            extra={
              <button type="button" className={iconButton} onClick={() => setWide((w) => !w)} aria-label={wide ? "Make narrower" : "Make wider"} title={wide ? "Make narrower" : "Make wider"}>
                {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            }
            close={<DialogPrimitive.Close aria-label="Close" className={iconButton}><X className="size-4" /></DialogPrimitive.Close>}
          />
          <div className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4", bodyClassName)}>{children}</div>
          {footer && <div className="shrink-0 border-t bg-popover px-5 py-3">{footer}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// Most of the screen first; drag up for full height, down to close.
const SNAP_POINTS: DrawerPrimitive.Root.SnapPoint[] = [0.72, 1]

function BottomPanel({ open, onOpenChange, title, description, actions, footer, children, className, bodyClassName, fullHeight }: Props) {
  const first = fullHeight ? 1 : SNAP_POINTS[0]
  const [snap, setSnap] = React.useState<DrawerPrimitive.Root.SnapPoint | null>(first)
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={(o) => { if (o) setSnap(first); onOpenChange(o) }} snapPoints={SNAP_POINTS} snapPoint={snap} onSnapPointChange={setSnap}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black/30 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DrawerPrimitive.Viewport className="fixed inset-0 z-50 flex items-end justify-center touch-none">
          <DrawerPrimitive.Popup
            className={cn(
              "relative flex max-h-[calc(100dvh-0.5rem)] min-h-0 w-full flex-col rounded-t-2xl border-t bg-popover text-sm text-popover-foreground shadow-2xl outline-none touch-none",
              "[padding-bottom:max(0px,calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] [transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))]",
              "transition-[transform,height] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)] data-starting-style:[padding-bottom:0] data-ending-style:[padding-bottom:0]",
              // Snap points only move the sheet; a short sheet needs a real
              // height to fill the screen when it's made full height.
              snap === 1 && "h-[calc(100dvh-0.5rem)]",
              className,
            )}
          >
            {/* Grab here (or anywhere on the header) to drag the sheet up or down. */}
            <div aria-hidden className="shrink-0 touch-none pt-2.5 pb-1 select-none">
              <span className="mx-auto block h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>
            <Header
              title={<DrawerPrimitive.Title className="truncate text-base font-semibold">{title}</DrawerPrimitive.Title>}
              description={description ? <DrawerPrimitive.Description className="text-sm text-muted-foreground">{description}</DrawerPrimitive.Description> : null}
              actions={actions}
              extra={
                <button type="button" className={iconButton} onClick={() => setSnap((s) => (s === 1 ? SNAP_POINTS[0] : 1))}
                  aria-label={snap === 1 ? "Make the sheet smaller" : "Make the sheet full height"} title={snap === 1 ? "Smaller" : "Full height"}>
                  {snap === 1 ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </button>
              }
              close={<DrawerPrimitive.Close aria-label="Close" className={iconButton}><X className="size-4" /></DrawerPrimitive.Close>}
            />
            <DrawerPrimitive.Content className={cn("min-h-0 flex-1 space-y-4 touch-auto overflow-y-auto overscroll-contain px-4 py-4", bodyClassName)}>{children}</DrawerPrimitive.Content>
            {footer && <div className="shrink-0 border-t bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">{footer}</div>}
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  )
}
