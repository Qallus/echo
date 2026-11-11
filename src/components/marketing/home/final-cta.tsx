import Link from "next/link";
import { ArrowRight, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Named } from "@/components/marketing/agent-name";

// The last call to action on marketing pages.
export function FinalCta({ title = "Let {agent} take the next call.", sub = "Set up takes about five minutes. Start free, no card needed.", business = false }: { title?: string; sub?: string; business?: boolean }) {
  return (
    <section className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_120%_at_0%_0%,#3f3f46_0%,#18181b_55%,#09090b_100%)] px-6 py-14 text-center text-white sm:px-12">
          <span className="pointer-events-none absolute -top-20 -right-16 size-72 rounded-full bg-white/10 blur-3xl" />
          <AudioLines className="mx-auto size-8 text-white/80" />
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl"><Named text={title} /></h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70"><Named text={sub} /></p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" className="bg-white text-neutral-900 hover:bg-white/90" nativeButton={false} render={<Link href={business ? "/signup?type=business" : "/signup"} />}>
              {business ? "Set up your business line" : "Start free"} <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" nativeButton={false} render={<Link href="/pricing" />}>See pricing</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
