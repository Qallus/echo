import Link from "next/link";
import type { Faq } from "@/lib/faq";

// A Questions section: the page's full content width, like the header.
export function FaqSection({ items, title = "Questions", className = "border-t bg-muted/30" }: { items: Faq[]; title?: string; className?: string }) {
  return (
    <section className={className}>
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
        <div className="mt-8 divide-y rounded-xl border bg-background">
          {items.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="flex items-center justify-between gap-4">{f.q}<span className="text-muted-foreground transition-transform group-open:rotate-45">+</span></span>
              </summary>
              <p className="mt-2 max-w-4xl text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground"><Link href="/faq" className="font-medium text-foreground underline underline-offset-2">See all questions</Link>, searchable by topic.</p>
      </div>
    </section>
  );
}
