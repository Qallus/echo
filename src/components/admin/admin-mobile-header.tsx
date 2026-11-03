"use client";

import { Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

// Sticky top bar on phones; the menu opens the admin sidebar as a drawer.
export function AdminMobileHeader() {
  const { toggleSidebar } = useSidebar();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <div className="flex h-12 items-center gap-1 px-2">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Open menu"><Menu className="size-5" /></Button>
        <ShieldCheck className="size-5" />
        <span className="font-semibold tracking-[0.2em]">ECHO ADMIN</span>
      </div>
    </header>
  );
}
