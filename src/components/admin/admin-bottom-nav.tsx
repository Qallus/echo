"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import type { Permission } from "@/lib/admin/permissions";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./admin-sidebar";

// The admin dashboard's bottom bar on phones, like the user dashboard's: every
// admin page the person can open slides sideways, and the menu button on the
// right opens the full sidebar.
export function AdminBottomNav({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const scroller = useRef<HTMLDivElement>(null);
  const items = ADMIN_NAV.flatMap((g) => g.items).filter((i) => !i.permission || permissions.includes(i.permission));
  const isActive = (href: string, exact?: boolean) => (exact || href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  // Keep the current page's button in view after navigating.
  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  return (
    <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="flex h-16 items-stretch">
        <div ref={scroller}
          className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto scroll-px-2 px-1 [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={cn("flex w-[4.5rem] shrink-0 snap-start flex-col items-center justify-center gap-1 text-[11px] transition-colors", active ? "text-foreground" : "text-muted-foreground")}>
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary/10 text-foreground")}>
                  <Icon className="size-5" />
                </span>
                <span className="max-w-full truncate px-1">{label}</span>
              </Link>
            );
          })}
          <span className="w-6 shrink-0" />
        </div>
        <div className="flex items-center border-l px-3">
          <button type="button" onClick={toggleSidebar} aria-label="All admin pages"
            className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95">
            <Menu className="size-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
