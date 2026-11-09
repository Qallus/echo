"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_MORE, NAV_PRODUCTS } from "./nav-links";
import { AppCard } from "./site-nav";

// Phone and tablet menu for the public site header (the desktop navigation is
// hidden below lg): Redial and Echo sections, the other pages, the app card.
export function MarketingMobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-80 gap-0 p-0 pt-[env(safe-area-inset-top)]">
        <SheetTitle className="border-b px-5 py-4 text-sm font-semibold tracking-[0.2em]">ECHO</SheetTitle>
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
          {NAV_PRODUCTS.map(({ name, icon: Icon, links }) => (
            <div key={name}>
              <p className="flex items-center gap-2 px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><Icon className="size-3.5" />{name}</p>
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={close} className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted">
                  <l.icon className="size-4 shrink-0 text-muted-foreground" />{l.title}
                </Link>
              ))}
            </div>
          ))}
          <div className="border-t pt-3">
            {NAV_MORE.map((l) => (
              <Link key={l.href} href={l.href} onClick={close} className="block rounded-md px-2 py-2.5 hover:bg-muted">{l.label}</Link>
            ))}
          </div>
          <AppCard onNavigate={close} />
        </nav>
        <div className="grid gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {signedIn ? (
            <Button nativeButton={false} render={<Link href="/" onClick={close} />}>Open Echo</Button>
          ) : (
            <>
              <Button nativeButton={false} render={<Link href="/signup" onClick={close} />}>Get started</Button>
              <Button variant="outline" nativeButton={false} render={<Link href="/login" onClick={close} />}>Sign in</Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
