"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { classify, type Attribution } from "@/lib/analytics/channels";

// Cookie-free site analytics for the public pages. Counts page views, and
// remembers for this browser tab (session storage, not a cookie) which
// channel brought the visitor, so a later signup or form is credited to it.
// Respects Global Privacy Control and Do Not Track. See docs/ANALYTICS_PLAN.md.

const ATTR = "redial.attr";
const SESSION = "redial.session";

const optedOut = () => {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.globalPrivacyControl === true || n.doNotTrack === "1";
};

function store<T>(key: string, make: () => T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
    const v = make();
    sessionStorage.setItem(key, JSON.stringify(v));
    return v;
  } catch {
    return make();
  }
}

// The channel that brought this visit (set once, on the first page).
export function attribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  return store<Attribution>(ATTR, () => classify(new URL(window.location.href), document.referrer, window.location.hostname));
}

const sessionId = () => store<string>(SESSION, () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 24));

function send(body: Record<string, unknown>) {
  if (optedOut()) return;
  const data = JSON.stringify({ ...attribution(), ...body, session: sessionId() });
  try {
    if (!navigator.sendBeacon?.("/api/t", new Blob([data], { type: "text/plain" }))) {
      void fetch("/api/t", { method: "POST", body: data, keepalive: true, headers: { "content-type": "text/plain" } });
    }
  } catch { /* never break the page */ }
}

// Record a conversion: signup, checkout, contact, partners, waitlist, booking…
export function track(name: string) {
  if (typeof window === "undefined") return;
  send({ kind: "conversion", name, path: window.location.pathname });
}

export function SiteAnalytics() {
  const path = usePathname();
  useEffect(() => {
    attribution(); // fix the channel on the first page of the visit
    send({ kind: "view", path });
  }, [path]);
  return null;
}
