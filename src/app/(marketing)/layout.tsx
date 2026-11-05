import Link from "next/link";
import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppBadges } from "@/components/marketing/app-badges";
import { MarketingMobileMenu } from "@/components/marketing/mobile-menu";
import { CartButton } from "@/components/store/store";
import { CatalogSync } from "@/components/store/catalog-sync";
import { loadCatalog } from "@/lib/billing/catalog-server";
import { ThemeToggle } from "@/components/theme";
import { getUser } from "@/lib/data";
import { COMPANY } from "@/lib/company";

// Public site: header and footer around the landing and pricing pages.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [user, catalog] = await Promise.all([getUser(), loadCatalog()]);
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogSync products={catalog} />
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <AudioLines className="size-5" />
            <span className="text-lg font-semibold tracking-[0.2em]">ECHO</span>
          </Link>
          {/* Right side, left to right: navigation, cart, Sign in, Get started, theme
              (the phone menu replaces the navigation below lg). */}
          <div className="ml-auto flex items-center gap-2">
            <nav className="mr-3 hidden items-center gap-5 text-sm text-muted-foreground lg:flex">
              <Link href="/#features" className="hover:text-foreground">Features</Link>
              <Link href="/#redial" className="hover:text-foreground">Redial</Link>
              <Link href="/#how" className="hover:text-foreground">How it works</Link>
              <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
              <Link href="/developers" className="hover:text-foreground">Developers</Link>
              <Link href="/contact" className="hover:text-foreground">Contact</Link>
            </nav>
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
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-start sm:px-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AudioLines className="size-4" />
              <span className="font-semibold tracking-[0.2em]">ECHO</span>
            </div>
            <p className="max-w-xs text-muted-foreground">Recordings, transcripts and summaries in one place.</p>
            <AppBadges source="footer" signedIn={!!user} className="pt-2" />
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-6 sm:ml-auto sm:flex">
            <div className="space-y-2">
              <p className="font-medium">Product</p>
              <Link href="/#features" className="block text-muted-foreground hover:text-foreground">Features</Link>
              <Link href="/pricing" className="block text-muted-foreground hover:text-foreground">Pricing</Link>
              <Link href="/developers" className="block text-muted-foreground hover:text-foreground">Developers</Link>
              <Link href="/contact" className="block text-muted-foreground hover:text-foreground">Contact</Link>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Legal</p>
              <Link href="/terms" className="block text-muted-foreground hover:text-foreground">Terms of Service</Link>
              <Link href="/privacy" className="block text-muted-foreground hover:text-foreground">Privacy Policy</Link>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Account</p>
              <Link href="/login" className="block text-muted-foreground hover:text-foreground">Sign in</Link>
              <Link href="/signup" className="block text-muted-foreground hover:text-foreground">Create account</Link>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Contact</p>
              <a href={`mailto:${COMPANY.email}`} className="block text-muted-foreground hover:text-foreground">{COMPANY.email}</a>
              <a href={COMPANY.phoneHref} className="block text-muted-foreground hover:text-foreground">{COMPANY.phone}</a>
              <p className="max-w-[12rem] text-muted-foreground">{COMPANY.address}</p>
            </div>
          </nav>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">© {new Date().getFullYear()} Qallus LLC. Echo is a product of Qallus LLC.</div>
      </footer>
    </div>
  );
}
