import Link from "next/link";
import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppBadges } from "@/components/marketing/app-badges";
import { MarketingMobileMenu } from "@/components/marketing/mobile-menu";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteSearch } from "@/components/marketing/site-search";
import { CartButton } from "@/components/store/store";
import { CatalogSync } from "@/components/store/catalog-sync";
import { loadCatalog } from "@/lib/billing/catalog-server";
import { ThemeToggle } from "@/components/theme";
import { getUser } from "@/lib/data";

// Footer columns: four of five links each, so the rows line up.
const FOOTER: { title: string; links: [string, string][] }[] = [
  { title: "Redial", links: [["Features", "/#redial"], ["For business", "/redial/business"], ["Live call controls", "/#controls"], ["Pricing", "/pricing"], ["FAQ", "/faq"]] },
  { title: "Phone service", links: [["Home phone", "/home-phone"], ["Business phone", "/business-phone"], ["Phones that work", "/compatibility"], ["Phone plans", "/pricing#phone-service"], ["Recording Studio", "/recording-studio"]] },
  { title: "Live Agents", links: [["Search Live Agents", "/live-agents"], ["How it works", "/live-agents/how-it-works"], ["Live Agent rates", "/live-agents/how-it-works#pricing"], ["Become an agent", "/become-a-live-agent"], ["Questions & answers", "/faq#topic-live-agents"]] },
  { title: "Company", links: [["Contact", "/contact"], ["Book a demo", "/book"], ["Developers", "/developers"], ["Sign in", "/login"], ["Create account", "/signup"]] },
];

// Public site: header and footer around the landing and pricing pages.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [user, catalog] = await Promise.all([getUser(), loadCatalog()]);
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogSync products={catalog} />
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <AudioLines className="size-5" />
            <span className="text-lg font-semibold tracking-[0.2em]">REDIAL</span>
          </Link>
          {/* Right side, left to right: navigation, search, cart, Sign in, Get started, theme
              (the phone menu replaces the navigation below lg). */}
          <div className="ml-auto flex items-center gap-0.5 sm:gap-2">
            <SiteNav />
            <span className="mx-1 hidden h-5 w-px bg-border lg:block" />
            <SiteSearch />
            <CartButton />
            {user ? (
              <Button nativeButton={false} render={<Link href="/" />}>Open Echo</Button>
            ) : (
              <>
                <Button variant="ghost" className="hidden sm:inline-flex" nativeButton={false} render={<Link href="/login" />}>Sign in</Button>
                <Button nativeButton={false} render={<Link href="/signup" />}>Get started</Button>
              </>
            )}
            <ThemeToggle />
            <MarketingMobileMenu signedIn={!!user} />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 text-sm sm:px-6 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-16">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AudioLines className="size-4" />
              <span className="font-semibold tracking-[0.2em]">REDIAL</span>
            </div>
            <p className="text-muted-foreground">Your AI assistant answers. You take the calls that matter. With Echo recordings and transcripts built in.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {FOOTER.map((col) => (
              <div key={col.title} className="space-y-2.5">
                <p className="font-medium">{col.title}</p>
                {col.links.map(([label, href]) => (
                  <Link key={href} href={href} className="block text-muted-foreground hover:text-foreground">{label}</Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className="border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center">
            <p>© {new Date().getFullYear()} Qallus LLC. Redial is a product of Qallus LLC.</p>
            <div className="flex gap-4">
              <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
              <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            </div>
            <AppBadges source="footer" signedIn={!!user} size="sm" className="md:ml-auto" />
          </div>
        </div>
      </footer>
    </div>
  );
}
