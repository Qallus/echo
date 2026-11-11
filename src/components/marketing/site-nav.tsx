"use client";

import Link from "next/link";
import {
  NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { AppleLogo, PlayLogo } from "./app-badges";
import { NAV_MORE, NAV_PRODUCTS } from "./nav-links";
import { Named } from "@/components/marketing/agent-name";

// Desktop header navigation (lg up): a Features mega menu with a column each
// for Redial, phone service and Echo plus a get-the-app card, then the other
// pages.
export function SiteNav() {
  const plain = cn(navigationMenuTriggerStyle(), "bg-transparent font-normal text-muted-foreground hover:text-foreground");
  return (
    <NavigationMenu align="center" className="hidden lg:flex">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-transparent font-normal text-muted-foreground hover:text-foreground data-popup-open:text-foreground">Features</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[min(1060px,calc(100vw-2rem))] grid-cols-[1fr_1fr_1fr_14rem] gap-2 p-2">
              {NAV_PRODUCTS.map(({ name, tagline, icon: Icon, links }) => (
                <div key={name} className="p-1">
                  <div className="flex items-center gap-2.5 px-2 pt-1 pb-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background"><Icon className="size-4" /></span>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground">{tagline}</p>
                    </div>
                  </div>
                  <ul className="space-y-0.5">
                    {links.map(({ href, title, desc, icon: LinkIcon }) => (
                      <li key={href}>
                        <NavigationMenuLink render={<Link href={href} />} className="items-start gap-3 px-2 py-2">
                          <LinkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block font-medium">{title}</span>
                            <span className="block truncate text-xs text-muted-foreground"><Named text={desc} /></span>
                          </span>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <AppCard />
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        {NAV_MORE.map((l) => (
          <NavigationMenuItem key={l.href}>
            <NavigationMenuLink render={<Link href={l.href} />} className={plain}>{l.label}</NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

// The get-the-app call to action: the Redial app, with Echo inside. The store
// buttons go to the app section on the home page until the listings are live.
export function AppCard({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  return (
    <div className={cn("relative flex flex-col overflow-hidden rounded-xl bg-[radial-gradient(120%_90%_at_0%_0%,#3f3f46_0%,#18181b_55%,#09090b_100%)] p-4 text-white", className)}>
      <span className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-white/10 blur-2xl" />
      <p className="text-[11px] font-medium tracking-[0.18em] text-white/60 uppercase">Mobile app</p>
      <p className="mt-2 text-lg leading-snug font-semibold">Redial on your phone</p>
      <p className="mt-1 text-xs leading-relaxed text-white/70">Screen calls from anywhere. Echo is built in, with one account on the web and your phone.</p>
      <div className="mt-auto grid gap-2 pt-4">
        {[{ logo: <AppleLogo />, small: "Download on the", big: "App Store" }, { logo: <PlayLogo />, small: "Get it on", big: "Google Play" }].map((b) => (
          <Link key={b.big} href="/#app" onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 transition-colors hover:bg-white/20 [&_svg]:size-5">
            {b.logo}
            <span className="leading-tight"><span className="block text-[10px] text-white/70">{b.small}</span><span className="block text-sm font-semibold">{b.big}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
