"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_MORE, NAV_PRODUCTS } from "./nav-links";
import { AppCard } from "./site-nav";

// Phone and tablet menu for the public site header (the desktop navigation is
// hidden below lg). Full width: the first panel lists the sections; tapping
// one slides its links in from the right, with Back to return.
export function MarketingMobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  // The last section stays drawn while it slides back out.
  const [shown, setShown] = useState<string | null>(null);
  const close = () => setOpen(false);
  const pick = (name: string) => { setShown(name); setSection(name); };
  const current = NAV_PRODUCTS.find((p) => p.name === section);
  const drawn = NAV_PRODUCTS.find((p) => p.name === shown);
  const panel = "absolute inset-0 flex flex-col transition-transform duration-300 ease-out motion-reduce:transition-none";

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSection(null); }}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 p-0 pt-[env(safe-area-inset-top)] data-[side=right]:w-full data-[side=right]:sm:max-w-none">
        <SheetTitle className="flex h-14 shrink-0 items-center border-b px-5 text-sm font-semibold tracking-[0.2em]">REDIAL</SheetTitle>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* Sections */}
          <div className={cn(panel, current ? "-translate-x-full" : "translate-x-0")} inert={Boolean(current)}>
            <nav aria-label="Site sections" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <ul className="divide-y">
                {NAV_PRODUCTS.map(({ name, tagline, icon: Icon }) => (
                  <li key={name}>
                    <button type="button" onClick={() => pick(name)} aria-haspopup="true"
                      className="flex w-full items-center gap-4 rounded-lg px-2 py-4 text-left hover:bg-muted active:bg-muted">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Icon className="size-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold">{name}</span>
                        <span className="block text-sm text-muted-foreground">{tagline}</span>
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-4">
                {NAV_MORE.filter((l) => !NAV_PRODUCTS.some((p) => p.name === l.label)).map((l) => (
                  <Link key={l.href} href={l.href} onClick={close} className="rounded-lg border px-3 py-3 text-sm font-medium hover:bg-muted">{l.label}</Link>
                ))}
              </div>
              <AppCard onNavigate={close} className="mt-4" />
            </nav>
            <div className="grid shrink-0 gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:grid-cols-2">
              {signedIn ? (
                <Button size="lg" nativeButton={false} render={<Link href="/home" onClick={close} />}>Dashboard</Button>
              ) : (
                <>
                  <Button size="lg" nativeButton={false} render={<Link href="/signup" onClick={close} />}>Get started</Button>
                  <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/login" onClick={close} />}>Sign in</Button>
                </>
              )}
            </div>
          </div>

          {/* One section's links */}
          <div className={cn(panel, "bg-popover", current ? "translate-x-0" : "translate-x-full")} inert={!current}>
            {drawn && (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b px-2 py-2">
                  <Button variant="ghost" size="sm" onClick={() => setSection(null)}><ChevronLeft /> Back</Button>
                </div>
                <nav aria-label={drawn.name} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  <div className="flex items-center gap-3 px-2 pb-4">
                    <span className="grid size-11 place-items-center rounded-xl bg-foreground text-background"><drawn.icon className="size-5" /></span>
                    <div>
                      <p className="text-xl font-semibold tracking-tight">{drawn.name}</p>
                      <p className="text-sm text-muted-foreground">{drawn.tagline}</p>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {drawn.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} onClick={close} className="flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-muted active:bg-muted">
                          <l.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block font-medium">{l.title}</span>
                            <span className="block text-sm text-muted-foreground">{l.desc}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
