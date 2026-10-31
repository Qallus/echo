"use client";

import Link from "next/link";
import { AudioLines, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/profile/user-avatar";

// Sticky top bar on phones: the menu button opens the full sidebar as a drawer.
export function MobileHeader({ me }: { me: { name: string | null; email: string; avatarUrl: string | null } }) {
  const { toggleSidebar } = useSidebar();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <div className="flex h-12 items-center gap-1 px-2">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Open menu"><Menu className="size-5" /></Button>
        <Link href="/" className="flex items-center gap-1.5 px-1">
          <AudioLines className="size-5" />
          <span className="font-semibold tracking-[0.2em]">ECHO</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/search" aria-label="Search" />}><Search className="size-5" /></Button>
          <Link href="/settings" aria-label="Account settings" className="flex size-9 items-center justify-center">
            <UserAvatar name={me.name} email={me.email} src={me.avatarUrl} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}
