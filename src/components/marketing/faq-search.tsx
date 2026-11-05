"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FAQ_TOPICS, faqId, type FaqTopic } from "@/lib/faq";
import { cn } from "@/lib/utils";

// The /faq page: every question, searchable and filterable by topic. Each
// question has its own anchor (/faq#<id>), which opens it on arrival.

function words(q: string) {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

// Wraps each search word found in the text in a <mark>.
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(pattern).map((part, i) =>
    i % 2 ? <mark key={i} className="rounded-sm bg-yellow-200/70 text-foreground dark:bg-yellow-500/30">{part}</mark> : part,
  );
}

export function FaqSearch() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<FaqTopic["id"] | "all">("all");
  const [hash, setHash] = useState("");

  // Open the question a link points at, clearing any filter that hides it.
  useEffect(() => {
    const read = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      setHash(h);
      if (h && !h.startsWith("topic-")) { setTopic("all"); setQuery(""); }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (hash) document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, [hash]);

  const terms = words(query);
  const groups = useMemo(() => FAQ_TOPICS
    .filter((g) => topic === "all" || g.id === topic)
    .map((g) => ({
      ...g,
      items: g.items.filter((f) => {
        const hay = `${f.q} ${f.a} ${g.title} ${f.tags ?? ""}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      }),
    }))
    .filter((g) => g.items.length), [topic, terms]);
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="mt-10">
      <div className="sticky top-16 z-10 -mx-4 space-y-3 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text" inputMode="search" enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, like “transfer a call” or “refund”"
            aria-label="Search the FAQ" className="h-11 pr-10 pl-9 text-base"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div role="group" aria-label="Topic" className="flex gap-2 overflow-x-auto text-sm [scrollbar-width:none] sm:flex-wrap">
          {[{ id: "all" as const, short: "All" }, ...FAQ_TOPICS].map((g) => (
            <button key={g.id} type="button" aria-pressed={topic === g.id} onClick={() => setTopic(g.id)}
              className={cn("shrink-0 rounded-full border px-3 py-1 transition-colors", topic === g.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {g.short}
            </button>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">
        {terms.length || topic !== "all" ? `${count} ${count === 1 ? "question" : "questions"}` : ""}
      </p>

      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`topic-${g.id}`} className="mt-8">
          <h2 id={`topic-${g.id}`} className="text-xl font-semibold tracking-tight">{g.title}</h2>
          {g.blurb && <p className="mt-1 text-sm text-muted-foreground">{g.blurb}</p>}
          <div className="mt-4 divide-y rounded-xl border bg-background">
            {g.items.map((f) => {
              const id = faqId(f.q);
              return (
                // Searching opens every match, so the highlighted answer shows.
                <details key={id} id={id} open={terms.length > 0 || hash === id || undefined} className="group scroll-mt-60 px-5 py-4">
                  <summary className="cursor-pointer list-none font-medium marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      <span><Highlight text={f.q} terms={terms} /></span>
                      <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground"><Highlight text={f.a} terms={terms} /></p>
                  <a href={`#${id}`} className="mt-2 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline">Link to this question</a>
                </details>
              );
            })}
          </div>
        </section>
      ))}

      {!count && (
        <div className="mt-10 rounded-xl border bg-muted/30 p-6 text-center">
          <p className="font-medium">No questions match &ldquo;{query}&rdquo;</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try fewer words, pick All, or <Link href="/contact" className="underline underline-offset-2">ask us directly</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
