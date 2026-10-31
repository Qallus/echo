import Link from "next/link";
import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/data";

// Public site: header and footer around the landing and pricing pages.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <AudioLines className="size-5" />
            <span className="text-lg font-semibold tracking-[0.2em]">ECHO</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
            <Link href="/#features" className="hover:text-foreground">Features</Link>
            <Link href="/#how" className="hover:text-foreground">How it works</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Button nativeButton={false} render={<Link href="/" />}>Open Echo</Button>
            ) : (
              <>
                <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>Sign in</Button>
                <Button nativeButton={false} render={<Link href="/signup" />}>Get started</Button>
              </>
            )}
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
          </div>
          <nav className="flex gap-10 sm:ml-auto">
            <div className="space-y-2">
              <p className="font-medium">Product</p>
              <Link href="/#features" className="block text-muted-foreground hover:text-foreground">Features</Link>
              <Link href="/pricing" className="block text-muted-foreground hover:text-foreground">Pricing</Link>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Account</p>
              <Link href="/login" className="block text-muted-foreground hover:text-foreground">Sign in</Link>
              <Link href="/signup" className="block text-muted-foreground hover:text-foreground">Create account</Link>
            </div>
          </nav>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">© {new Date().getFullYear()} Echo</div>
      </footer>
    </div>
  );
}
