"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

export type LinkTab = { href: string; label: string; exact?: boolean; defaultTab?: boolean; count?: number };

// Links that look like tabs: one page per tab, so Back and shared links work.
// Slides sideways on phones when the tabs don't fit.
export function LinkTabs({ tabs, label, className }: { tabs: LinkTab[]; label: string; className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  return (
    <nav aria-label={label} className={cn("-mx-4 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden", className)}>
      {tabs.map((t) => {
        const active = isActive(t.href, pathname, search, t.exact ?? true, t.defaultTab);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
