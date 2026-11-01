import { fill, type BlockId, type MergeValues, type SummaryDesign } from "@/lib/designs/schema";
import type { ActionGroup, Highlight, SummarySection } from "@/lib/types";
import { formatClock } from "@/lib/format";

// A branded summary, drawn from a design. Used by the builder's live canvas and
// by the printable report page. Inline styles carry the design's colors.

export type SummaryData = {
  overview: string;
  sections: SummarySection[];
  keyPoints: string[];
  actionGroups: ActionGroup[];
  highlights: Highlight[];
  mindMap: { root: string; branches: string[] };
  listenUrl?: string;
};

const ALIGN = { left: "flex-start", center: "center", right: "flex-end" } as const;

export function SummaryDocument({ design: d, data, values, selected, onSelect }: {
  design: SummaryDesign; data: SummaryData; values: MergeValues;
  // Builder only: highlight and pick a part of the document.
  selected?: string; onSelect?: (part: string) => void;
}) {
  const font = d.page.font === "serif" ? "Georgia, 'Times New Roman', serif" : "var(--font-geist-sans), -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  const pick = (part: string, base = "") => onSelect ? {
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSelect(part); },
    className: `${base} cursor-pointer outline-offset-[-2px] ${selected === part ? "outline-2 outline-dashed outline-sky-500" : "hover:outline-1 hover:outline-dashed hover:outline-sky-400"}`,
  } : { className: base };
  const heading = (t: string) => <h2 style={{ color: d.page.accent }} className="mb-3 text-lg font-semibold tracking-tight">{t}</h2>;

  const blocks: Record<BlockId, React.ReactNode> = {
    overview: data.overview ? <section>{heading("Overview")}<p className="leading-relaxed">{data.overview}</p></section> : null,
    sections: data.sections.filter((s) => s.bullets.length).length ? (
      <div className="space-y-7">
        {data.sections.filter((s) => s.bullets.length).map((s) => (
          <section key={s.heading}>{heading(s.heading)}<ul className="list-disc space-y-1.5 pl-5">{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul></section>
        ))}
      </div>
    ) : null,
    keyPoints: data.keyPoints.length ? <section>{heading("Key points")}<ul className="list-disc space-y-1.5 pl-5">{data.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul></section> : null,
    actionItems: data.actionGroups.length ? (
      <section>{heading("Action items")}
        <div className="space-y-4">
          {data.actionGroups.map((g) => (
            <div key={g.owner}>
              <p className="font-medium">{g.owner}</p>
              <ul className="mt-1 space-y-1">{g.items.map((i) => (
                <li key={i.id} className="flex items-start gap-2"><span className="mt-1 inline-block size-3.5 shrink-0 rounded-sm border" style={{ borderColor: d.page.accent, background: i.done ? d.page.accent : "transparent" }} />{i.text}</li>
              ))}</ul>
            </div>
          ))}
        </div>
      </section>
    ) : null,
    highlights: data.highlights.length ? (
      <section>{heading("Highlights")}
        <div className="space-y-4">
          {data.highlights.map((h, i) => (
            <div key={h.id ?? i} className="grid grid-cols-[3.5rem_1fr] gap-3">
              <span className="pt-0.5 text-sm tabular-nums opacity-60">{formatClock(h.startSec)}</span>
              <div><p className="font-medium">{h.title || h.text}</p>
                {!!h.bullets?.length && <ul className="mt-1 list-disc space-y-1 pl-5 text-[0.95em] opacity-85">{h.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}</div>
            </div>
          ))}
        </div>
      </section>
    ) : null,
    mindMap: data.mindMap.branches.length ? (
      <section>{heading("Mind map")}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-3 py-1 text-sm font-medium" style={{ background: d.page.accent, color: d.page.content }}>{data.mindMap.root}</span>
          {data.mindMap.branches.map((b) => <span key={b} className="rounded-full border px-3 py-1 text-sm" style={{ borderColor: d.page.accent }}>{b}</span>)}
        </div>
      </section>
    ) : null,
    listen: data.listenUrl ? (
      <section><a href={data.listenUrl} className="inline-block rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: d.page.accent, color: d.page.content }}>Listen to the recording</a></section>
    ) : null,
  };

  return (
    <div style={{ background: d.page.background, fontFamily: font }} className="p-4 sm:p-8 print:p-0">
      <article style={{ background: d.page.content, color: d.page.text }} className="mx-auto max-w-3xl overflow-hidden rounded-xl shadow-sm print:rounded-none print:shadow-none">
        <header style={{ background: d.header.background, color: d.header.textColor }} {...pick("header")}>
          <div className="space-y-4 px-6 py-7 sm:px-10 sm:py-9">
            {d.logo.url && (
              <div style={{ display: "flex", justifyContent: ALIGN[d.logo.align] }} {...pick("logo")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- any user-hosted logo */}
                <img src={d.logo.url} alt="" style={{ height: d.logo.height, width: "auto", maxWidth: "100%" }} />
              </div>
            )}
            <div>
              <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{fill(d.header.title, values)}</h1>
              {d.header.subtitle && <p className="mt-1.5 text-sm opacity-75">{fill(d.header.subtitle, values)}</p>}
            </div>
          </div>
        </header>

        <div {...pick("body", "space-y-9 px-6 py-8 text-[15px] sm:px-10")}>
          {d.blocks.filter((b) => b.enabled && blocks[b.id]).map((b) => <div key={b.id}>{blocks[b.id]}</div>)}
        </div>

        <footer style={{ background: d.footer.background, color: d.footer.textColor }} {...pick("footer", "px-6 py-6 text-sm sm:px-10")}>
          {d.footer.text && <p className="whitespace-pre-line">{fill(d.footer.text, values)}</p>}
          {d.footer.links && <p className="mt-2 whitespace-pre-line opacity-80">{fill(d.footer.links, values)}</p>}
          {d.footer.poweredBy && <p className="mt-3 text-xs opacity-60">Summarized by Echo</p>}
        </footer>
      </article>
    </div>
  );
}
