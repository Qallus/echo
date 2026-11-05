import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FaqSearch } from "@/components/marketing/faq-search";
import { ALL_FAQ } from "@/lib/faq";

export const metadata = {
  title: "FAQ · Echo and Redial",
  description: "Answers about Echo recordings, transcripts and AI, Redial call screening and live call controls, plans and billing, privacy and the mobile app.",
  alternates: { canonical: "/faq" },
};

// Search engines read the questions from this structured data.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ALL_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />
      <header>
        <p className="text-sm font-medium text-muted-foreground">Help</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Frequently asked questions</h1>
        <p className="mt-4 text-muted-foreground">Everything about Echo and Redial in one place. Search, or pick a topic.</p>
      </header>

      <FaqSearch />

      <section className="mt-16 rounded-xl border bg-muted/30 p-6 text-center">
        <h2 className="text-lg font-semibold">Still have a question?</h2>
        <p className="mt-1 text-sm text-muted-foreground">We reply within one business day.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button nativeButton={false} render={<Link href="/contact" />}>Contact us</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/book" />}>Book a call</Button>
        </div>
      </section>
    </div>
  );
}
