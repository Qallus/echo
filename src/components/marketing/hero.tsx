"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AudioLines, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceDemo, ECHO_SCENES } from "./hero-demo/hero-demo";
import { REDIAL_SCENES } from "./hero-demo/redial-scenes";
import { cn } from "@/lib/utils";

// The home page hero takes turns between Echo and Redial: each plays its
// demo through once, then the other takes over. Every visit starts with the
// one shown least recently, so returning visitors see the other product
// first. Visitors can switch with the toggle.

const PRODUCTS = {
  echo: {
    name: "Echo", icon: AudioLines, eyebrow: "Recordings, transcripts and summaries in one place",
    title: "Every call and meeting, captured and searchable.",
    sub: "Record in your browser, take notes as you talk, and get speaker-labelled transcripts automatically. Share with your team or keep it private.",
    more: { href: "/#how", label: "See how it works" }, scenes: ECHO_SCENES, demoTitle: "Launch plan review", phone: false,
  },
  redial: {
    name: "Redial", icon: PhoneCall, eyebrow: "AI call screening with you in control",
    title: "Your assistant answers. You take the calls that matter.",
    sub: "Redial screens unknown callers, takes messages and books callbacks. Listen in, guide it, take over or transfer, all on the same call.",
    more: { href: "/#redial", label: "See what Redial does" }, scenes: REDIAL_SCENES, demoTitle: "Call from (480) 555-0142", phone: true,
  },
} as const;
type Product = keyof typeof PRODUCTS;
const KEY = "echo-home-hero";

export function Hero() {
  const [product, setProduct] = useState<Product>("echo");
  const chosen = useRef<Product | null>(null);
  const show = useCallback((id: Product) => {
    setProduct(id);
    try { localStorage.setItem(KEY, id); } catch {}
  }, []);

  // Start with whichever product this browser saw least recently. Chosen once
  // per visit (the ref survives React running effects twice in development).
  useEffect(() => {
    if (!chosen.current) {
      let last: string | null = null;
      try { last = localStorage.getItem(KEY); } catch {}
      chosen.current = last === "echo" ? "redial" : "echo";
    }
    show(chosen.current);
  }, [show]);

  const next = useCallback(() => setProduct((p) => {
    const n = p === "echo" ? "redial" : "echo";
    try { localStorage.setItem(KEY, n); } catch {}
    return n;
  }), []);
  const p = PRODUCTS[product];

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
        <div role="tablist" aria-label="Product" className="mx-auto mb-6 inline-flex rounded-full border bg-muted/40 p-1 text-sm">
          {(Object.keys(PRODUCTS) as Product[]).map((id) => {
            const Icon = PRODUCTS[id].icon;
            return (
              <button key={id} type="button" role="tab" aria-selected={product === id} onClick={() => show(id)}
                className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-colors", product === id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="size-4" />{PRODUCTS[id].name}
              </button>
            );
          })}
        </div>
        <div key={product} className="hero-in">
          <p className="mb-4 text-sm text-muted-foreground">{p.eyebrow}</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{p.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-balance text-muted-foreground">{p.sub}</p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>Start free</Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href={p.more.href} />}>{p.more.label}</Button>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6" aria-label={`${p.name} demo`}>
        <DeviceDemo key={product} scenes={p.scenes} title={p.demoTitle} Logo={p.icon} phone={p.phone} onLoop={next} />
      </section>
    </>
  );
}
