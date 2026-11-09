"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AudioLines, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceDemo, ECHO_SCENES } from "./hero-demo/hero-demo";
import { REDIAL_SCENES } from "./hero-demo/redial-scenes";
import { cn } from "@/lib/utils";

// The home page hero takes turns between Redial and Echo: Redial opens first,
// plays its demo through once, then Echo takes over (and back again).
// Visitors can switch with the toggle.

const PRODUCTS = {
  redial: {
    name: "Redial", icon: PhoneCall, eyebrow: "AI call screening with you in control",
    title: "Your assistant answers. You take the calls that matter.",
    sub: "Redial screens unknown callers, takes messages and books callbacks. Listen in, guide it, take over or transfer, all on the same call.",
    more: { href: "/#redial", label: "See what Redial does" }, scenes: REDIAL_SCENES, demoTitle: "Call from (480) 555-0142", phone: true,
  },
  echo: {
    name: "Echo", icon: AudioLines, eyebrow: "Recordings, transcripts and summaries in one place",
    title: "Every call and meeting, captured and searchable.",
    sub: "Record in your browser, take notes as you talk, and get speaker-labelled transcripts automatically. Share with your team or keep it private.",
    more: { href: "/#how", label: "See how it works" }, scenes: ECHO_SCENES, demoTitle: "Launch plan review", phone: false,
  },
} as const;
type Product = keyof typeof PRODUCTS;

export function Hero() {
  const [product, setProduct] = useState<Product>("redial");
  const next = useCallback(() => setProduct((p) => (p === "echo" ? "redial" : "echo")), []);
  const p = PRODUCTS[product];

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
        <div role="tablist" aria-label="Product" className="mx-auto mb-6 inline-flex rounded-full border bg-muted/40 p-1 text-sm">
          {(Object.keys(PRODUCTS) as Product[]).map((id) => {
            const Icon = PRODUCTS[id].icon;
            return (
              <button key={id} type="button" role="tab" aria-selected={product === id} onClick={() => setProduct(id)}
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
