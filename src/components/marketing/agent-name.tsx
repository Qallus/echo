"use client";

import { Fragment, useSyncExternalStore } from "react";
import { AGENT_NAMES } from "@/lib/redial/agent-names";

// The assistant's name on the public site rotates through the suggested names
// (Ara, Rex, Eve, Leo). One shared clock keeps every mention on the page
// showing the same name. Held on the first name when the visitor prefers
// reduced motion.

const ROTATE_MS = 3200;
let index = 0;
let timer: number | undefined;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!timer && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    timer = window.setInterval(() => {
      index = (index + 1) % AGENT_NAMES.length;
      listeners.forEach((l) => l());
    }, ROTATE_MS);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) { window.clearInterval(timer); timer = undefined; }
  };
}

export function useAgentName() {
  return AGENT_NAMES[useSyncExternalStore(subscribe, () => index, () => 0)].name;
}

export function AgentName() {
  const name = useAgentName();
  return <span key={name} className="agent-name inline-block">{name}</span>;
}

// Renders a string with each "{agent}" swapped for the rotating name.
export function Named({ text }: { text: string }) {
  const parts = text.split("{agent}");
  if (parts.length === 1) return text;
  return parts.map((p, i) => <Fragment key={i}>{p}{i < parts.length - 1 && <AgentName />}</Fragment>);
}
