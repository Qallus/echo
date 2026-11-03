"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { addProduct, savePrice, saveProduct, syncCatalogToStripe } from "@/lib/admin/actions/billing";
import { KIND_LABEL, money, per, type Interval, type Kind, type Price, type Product, type Tier } from "@/lib/billing/catalog";
import { cn } from "@/lib/utils";

type Msg = { ok?: string; error?: string };
const SELECT = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const toCents = (dollars: string) => Math.round(Number(dollars) * 100);
const toDollars = (cents?: number) => (cents == null ? "" : (cents / 100).toString());

function priceLabel(p: Price) {
  if (p.tiers) return `${p.tiers.map((t) => `${money(t.unitAmount)}${t.upTo ? ` to ${t.upTo}` : "+"}`).join(", ")} per seat${per(p.interval)}`;
  return `${money(p.unitAmount ?? 0)}${per(p.interval)}`;
}

// Products and prices for the store. Saving a price that changed creates a
// new Stripe price when Stripe is connected; existing subscribers keep theirs.
export function CatalogEditor({ products, stripeReady, readOnly }: { products: Product[]; stripeReady: boolean; readOnly: boolean }) {
  const [msg, setMsg] = useState<Msg>({});
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const kinds = Object.keys(KIND_LABEL) as Kind[];

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={pending || !stripeReady} onClick={() => start(async () => setMsg(await syncCatalogToStripe()))}>
            <RefreshCw /> Sync to Stripe
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}><Plus /> Add product</Button>
          <span className="text-xs text-muted-foreground">{stripeReady ? "Stripe connected." : "Stripe isn't connected yet: changes save to Echo and sync once STRIPE_SECRET_KEY is set."}</span>
        </div>
      )}
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
      {adding && <AddProduct onDone={(m) => { setMsg(m); if (m.ok) setAdding(false); }} />}

      {kinds.map((kind) => {
        const list = products.filter((p) => p.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{KIND_LABEL[kind]}</h3>
            <ul className="divide-y rounded-xl border">
              {list.map((p) => <ProductRow key={p.id} product={p} readOnly={readOnly} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ProductRow({ product: p, readOnly }: { product: Product; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: p.name, tagline: p.tagline, features: (p.features ?? []).join("\n"), minutes: p.minutes?.toString() ?? "", active: p.active !== false, sort: 0 });
  const [msg, setMsg] = useState<Msg>({});
  const [pending, start] = useTransition();
  const showMinutes = p.kind === "plan" || p.kind === "pack";

  return (
    <li className={cn("p-3", p.active === false && "opacity-60")}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{p.name}</span> <code className="text-xs text-muted-foreground">{p.id}</code>
          <span className="block truncate text-xs text-muted-foreground">{p.prices.filter((x) => x.active !== false).map(priceLabel).join(" · ") || "No active price"}</span>
        </span>
        {p.active === false && <Badge variant="outline">Hidden</Badge>}
        {showMinutes && p.minutes ? <Badge variant="outline">{p.minutes.toLocaleString()} min</Badge> : null}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault();
            start(async () => setMsg(await saveProduct(p.id, { name: f.name, tagline: f.tagline, features: f.features.split("\n"), minutes: f.minutes === "" ? null : Number(f.minutes), active: f.active, sort: f.sort })));
          }}>
            <fieldset disabled={readOnly} className="contents">
              <label className="space-y-1 text-sm">Name<Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
              {showMinutes && (
                <label className="space-y-1 text-sm">{p.kind === "plan" ? `Minutes per month${p.perSeat ? " (per seat)" : ""}` : "Minutes in the pack"}
                  <Input type="number" min={0} value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} />
                </label>
              )}
              <label className="space-y-1 text-sm sm:col-span-2">Tagline<Input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></label>
              {p.kind === "plan" && (
                <label className="space-y-1 text-sm sm:col-span-2">Features (one per line)
                  <Textarea rows={4} value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} />
                </label>
              )}
              <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(active) => setF({ ...f, active })} /> For sale</label>
              {!readOnly && <div className="flex items-center justify-end"><Button type="submit" size="sm" disabled={pending}>Save product</Button></div>}
            </fieldset>
          </form>
          {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
          {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}

          <div className="space-y-2">
            <p className="text-sm font-medium">Prices</p>
            {p.prices.map((pr) => <PriceEditor key={pr.key} price={pr} readOnly={readOnly} />)}
          </div>
        </div>
      )}
    </li>
  );
}

function PriceEditor({ price, readOnly }: { price: Price; readOnly: boolean }) {
  const [amount, setAmount] = useState(toDollars(price.unitAmount));
  const [tiers, setTiers] = useState<{ upTo: string; amount: string }[]>((price.tiers ?? []).map((t) => ({ upTo: t.upTo?.toString() ?? "", amount: toDollars(t.unitAmount) })));
  const [active, setActive] = useState(price.active !== false);
  const [msg, setMsg] = useState<Msg>({});
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const t: Tier[] | null = price.tiers ? tiers.map((x) => ({ upTo: x.upTo === "" ? null : Number(x.upTo), unitAmount: toCents(x.amount) })) : null;
    setMsg(await savePrice(price.key, { unitAmount: t ? null : toCents(amount), tiers: t, active }));
  });

  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-xs">{price.key}</code>
        <Badge variant="outline">{price.interval === "month" ? "Monthly" : price.interval === "year" ? "Annual" : "One-time"}</Badge>
        <label className="ml-auto flex items-center gap-2 text-xs"><Switch size="sm" checked={active} disabled={readOnly} onCheckedChange={setActive} /> Active</label>
      </div>
      {price.tiers ? (
        <div className="space-y-1">
          {tiers.map((t, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-24 text-muted-foreground">{i === 0 ? "Seats 1" : `Seats ${Number(tiers[i - 1].upTo) + 1}`} to</span>
              <Input className="h-7 w-20 text-xs" disabled={readOnly || i === tiers.length - 1} placeholder="no limit" value={t.upTo}
                onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, upTo: e.target.value } : x)))} />
              <span className="text-muted-foreground">at $</span>
              <Input className="h-7 w-24 text-xs" type="number" step="0.01" min={0} disabled={readOnly} value={t.amount}
                onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              <span className="text-muted-foreground">per seat</span>
              {!readOnly && tiers.length > 1 && i < tiers.length - 1 && (
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove tier" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}><Trash2 /></Button>
              )}
            </div>
          ))}
          {!readOnly && (
            // New tiers go before the last (open-ended) one; fill in where it stops.
            <Button type="button" size="sm" variant="ghost" onClick={() => setTiers([...tiers.slice(0, -1), { upTo: "", amount: tiers.at(-1)?.amount ?? "0" }, { upTo: "", amount: tiers.at(-1)?.amount ?? "0" }])}>
              <Plus /> Add tier
            </Button>
          )}
        </div>
      ) : (
        <label className="flex items-center gap-2">$
          <Input className="h-8 w-28" type="number" step="0.01" min={0} disabled={readOnly} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="text-muted-foreground">{per(price.interval) || "once"}</span>
        </label>
      )}
      {!readOnly && <Button size="sm" variant="outline" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save price"}</Button>}
      {msg.error && <p className="text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-muted-foreground">{msg.ok}</p>}
    </div>
  );
}

function AddProduct({ onDone }: { onDone: (m: Msg) => void }) {
  const [f, setF] = useState({ id: "", kind: "bolt_on" as Kind, name: "", tagline: "", priceKey: "", interval: "month" as Interval | "once", amount: "" });
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-2 rounded-xl border p-4 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => onDone(await addProduct({ id: f.id, kind: f.kind, name: f.name, tagline: f.tagline, priceKey: f.priceKey || `${f.id}_${f.interval === "once" ? "once" : f.interval === "month" ? "monthly" : "annual"}`, interval: f.interval === "once" ? null : f.interval, unitAmount: toCents(f.amount) })));
    }}>
      <Input required placeholder="ID, e.g. bolt_call_line" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} aria-label="Product ID" />
      <select className={SELECT} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Kind })} aria-label="Kind">
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
      </select>
      <Input required placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Name" />
      <Input placeholder="Tagline" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} aria-label="Tagline" />
      <select className={SELECT} value={f.interval} onChange={(e) => setF({ ...f, interval: e.target.value as Interval | "once" })} aria-label="Billing">
        <option value="month">Monthly</option><option value="year">Annual</option><option value="once">One-time</option>
      </select>
      <Input required type="number" step="0.01" min={0} placeholder="Price in $" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} aria-label="Price" />
      <Input placeholder="Price key (optional)" value={f.priceKey} onChange={(e) => setF({ ...f, priceKey: e.target.value })} aria-label="Price key" />
      <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add product"}</Button>
    </form>
  );
}
