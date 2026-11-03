"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/developers", label: "Developers" },
  { href: "/contact", label: "Contact" },
];

// Phone and tablet menu for the public site header (the inline links are hidden below lg).
export function MarketingMobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-72 gap-0 p-0 pt-[env(safe-area-inset-top)]">
        <SheetTitle className="border-b px-5 py-4 text-sm font-semibold tracking-[0.2em]">ECHO</SheetTitle>
        <nav className="flex flex-col p-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={close} className="rounded-md px-3 py-3 text-base hover:bg-muted">{l.label}</Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
