// Layout for Terms and Privacy: title, dates, a table of contents and
// numbered sections.

export type LegalSection = { id: string; title: string; body: React.ReactNode };

export const COMPANY = {
  name: "Qallus LLC",
  product: "Echo",
  state: "Arizona",
  email: "jwaters@qallus.co",
  site: "https://echo.redial.si",
  // TODO(Jeremy): add a mailing address before launch.
  address: "[Mailing address to be added]",
};

export function LegalDoc({ title, updated, intro, sections }: { title: string; updated: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="text-muted-foreground">{intro}</div>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-24 space-y-2 text-sm text-muted-foreground">
            {sections.map((s, i) => (
              <li key={s.id}><a href={`#${s.id}`} className="hover:text-foreground">{i + 1}. {s.title}</a></li>
            ))}
          </ol>
        </nav>
        <div className="max-w-3xl space-y-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">{i + 1}. {s.title}</h2>
              <div className="space-y-3 text-[15px] leading-relaxed text-foreground/85 [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
