"use client";

import { useSyncExternalStore } from "react";
import { findPrice } from "./catalog";

// The cart lives in localStorage so it survives sign-in and reloads. Rules:
// one plan at most (adding another replaces it), one of each bolt-on, any
// quantity of packs and services. For Business, quantity = seats.

export type CartLine = { key: string; quantity: number };

const STORAGE = "echo-cart";
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;
const EMPTY: CartLine[] = [];

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE) ?? "[]") as CartLine[];
    cache = parsed.filter((l) => findPrice(l.key) && l.quantity > 0);
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines;
  try { localStorage.setItem(STORAGE, JSON.stringify(lines)); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE) { cache = null; fn(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
}

export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function addToCart(key: string, quantity = 1) {
  const hit = findPrice(key);
  if (!hit) return;
  let lines = read().slice();
  if (hit.product.kind === "plan") {
    lines = lines.filter((l) => findPrice(l.key)?.product.kind !== "plan");
  }
  const same = lines.find((l) => findPrice(l.key)?.product.id === hit.product.id);
  if (same && (hit.product.kind === "bolt_on" || hit.product.kind === "plan")) {
    same.key = key; // switch monthly <-> annual
    same.quantity = hit.product.perSeat ? quantity : 1;
  } else if (same && same.key === key) {
    same.quantity += quantity;
  } else {
    lines.push({ key, quantity: hit.product.kind === "bolt_on" || (hit.product.kind === "plan" && !hit.product.perSeat) ? 1 : quantity });
  }
  write(lines.map((l) => ({ ...l })));
}

export function setQuantity(key: string, quantity: number) {
  write(read().map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(500, Math.round(quantity))) } : l)));
}

export function removeFromCart(key: string) {
  write(read().filter((l) => l.key !== key));
}

export function clearCart() {
  write([]);
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + (findPrice(l.key)?.product.perSeat ? 1 : l.quantity), 0);
