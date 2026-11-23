"use client";

import Link from "next/link";
import { AudioLines, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { ModeBadge } from "@/components/shell/shell";
import { StatsToggle } from "@/components/shell/stats-toggle";
import { DashboardSearch } from "@/components/shell/dashboard-search";

// Sticky top bar on phones; the menu opens the admin sidebar as a drawer.
export function AdminMobileHeader({ permissions }: { permissions: string[] }) {
  const { toggleSidebar } = useSidebar();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <div className="flex h-12 items-center gap-1 px-2">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Open menu"><Menu className="size-5" /></Button>
        <Link href="/admin" className="flex items-center gap-1.5 px-1">
          <AudioLines className="size-5" />
          <span className="font-semibold tracking-[0.2em]">REDIAL</span>
        </Link>
        {/* Right side, always at the far edge (the stats toggle only shows on pages with stats). */}
        <div className="ml-auto flex items-center gap-1">
          <StatsToggle className="max-[359px]:hidden" />
          <DashboardSearch mode="admin" permissions={permissions} />
          <ModeBadge mode="admin" canAdmin compact />
        </div>
      </div>
    </header>
  );
}
