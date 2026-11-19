"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, Plus, Power, PowerOff, TicketPercent } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { downloadCsv } from "@/components/admin/list-csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createPromoCode, setPromoCodeActive, updatePromoCode, type PromoInput } from "@/lib/admin/actions/billing";
import { KIND_LABEL, money, type Kind } from "@/lib/billing/catalog";
import { STATUS_LABEL, discountLabel, promoStatus, showDay, toDay, type PromoRow, type PromoStatus } from "@/lib/billing/promo-rules";

type ProductOption = { id: string; name: string; kind: Kind };
type Msg = { ok?: string; error?: string };

const TYPE_OPTIONS = [{ value: "percent", label: "% off" }, { value: "amount", label: "$ off" }];
const DURATION_OPTIONS = [{ value: "once", label: "First payment only" }, { value: "repeating", label: "A number of months" }, { value: "forever", label: "Every payment" }];
const STATUS_STYLE: Record<PromoStatus, string> = {
  active: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  scheduled: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  expired: "text-muted-foreground", used_up: "text-muted-foreground", off: "text-muted-foreground",
};

const used = (c: PromoRow) => `${c.used}${c.maxUses != null ? ` of ${c.maxUses.toLocaleString()}` : ""} used`;
const badge = (c: PromoRow) => { const st = promoStatus(c); return <Badge variant="outline" className={STATUS_STYLE[st]}>{STATUS_LABEL[st]}</Badge>; };
const icon = () => <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><TicketPercent className="size-4" /></span>;

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const str = (v: number | null, div = 1) => (v == null ? "" : String(v / div));

// Admin -> Billing -> Promo codes. Customers enter codes in the cart, where
// every rule here is checked.
export function PromoCodes({ codes, readOnly, products }: { codes: PromoRow[]; readOnly: boolean; products: ProductOption[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [msg, setMsg] = useState<Msg>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const limits = (c: PromoRow) => [
    c.startsAt && `Starts ${showDay(c.startsAt)}`,
    c.expiresAt && `Expires ${showDay(c.expiresAt)}`,
    c.minOrder != null && `Orders ${money(c.minOrder)}+`,
    c.maxOrder != null && `Orders up to ${money(c.maxOrder)}`,
    c.perCustomer != null && `${c.perCustomer} per customer`,
    c.firstTimeOnly && "First-time customers",
    c.email && `Only ${c.email}`,
    c.products.length ? `Only ${c.products.map(productName).join(", ")}` : null,
  ].filter(Boolean) as string[];
  const setAll = (rows: PromoRow[], on: boolean) => start(async () => {
    for (const c of rows.filter((x) => x.active !== on)) { const r = await setPromoCodeActive(c.id, on); if (r.error) { setMsg(r); break; } setMsg(r); }
    router.refresh();
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Customers enter codes in the cart. The discount shows on their receipt under the code&apos;s name.</p>
        {!readOnly && <Button size="sm" onClick={() => { setMsg({}); setCreating(true); }}><Plus /> New promo code</Button>}
      </div>
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}

      <CollectionView<PromoRow>
        items={codes} getId={(c) => c.id} title={(c) => c.code} subtitle={(c) => `${c.name} · ${discountLabel(c)}`} media={icon} badge={badge}
        noun={["promo code", "promo codes"]} storageKey="admin-billing-promos" defaultView="list" empty="No promo codes yet."
        meta={(c) => <>{used(c)}{c.orders > 0 ? ` · ${money(c.given)} given on ${c.orders} order${c.orders === 1 ? "" : "s"}` : ""}</>}
        searchText={(c) => `${c.code} ${c.name} ${c.email ?? ""} ${c.note}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          ...(["active", "scheduled", "expired", "used_up", "off"] as PromoStatus[]).map((st) => ({ id: st, label: STATUS_LABEL[st], test: (c: PromoRow) => promoStatus(c) === st })),
        ]}
        date={(c) => c.startsAt ?? c.expiresAt}
        columns={[
          { id: "code", label: "Code", sort: (c) => c.code, cell: (c) => <code className="rounded bg-muted px-1.5 py-0.5 font-semibold">{c.code}</code> },
          { id: "name", label: "Name", sort: (c) => c.name.toLowerCase(), cell: (c) => <span className="font-medium">{c.name}</span> },
          { id: "discount", label: "Discount", cell: (c) => <span className="text-muted-foreground">{discountLabel(c)}</span> },
          { id: "status", label: "Status", sort: (c) => promoStatus(c), cell: badge },
          { id: "used", label: "Used", sort: (c) => c.used, className: "tabular-nums", cell: used },
          { id: "given", label: "Given", sort: (c) => c.given, className: "text-right tabular-nums", cell: (c) => money(c.given) },
          { id: "expires", label: "Expires", sort: (c) => c.expiresAt, cell: (c) => <span className="text-muted-foreground">{c.expiresAt ? showDay(c.expiresAt) : "Never"}</span> },
        ]}
        actions={[
          ...(readOnly ? [] : [
            { label: "Turn on", icon: Power, show: (rows: PromoRow[]) => rows.some((c) => !c.active), run: (rows: PromoRow[]) => setAll(rows, true) },
            { label: "Turn off", icon: PowerOff, show: (rows: PromoRow[]) => rows.some((c) => c.active), run: (rows: PromoRow[]) => setAll(rows, false) },
          ]),
          { label: "Export", icon: Download, run: (rows) => downloadCsv("promo-codes.csv", ["Code", "Name", "Discount", "Status", "Used", "Max uses", "Given", "Orders", "Starts", "Expires"],
            rows.map((c) => [c.code, c.name, discountLabel(c), STATUS_LABEL[promoStatus(c)], c.used, c.maxUses, (c.given / 100).toFixed(2), c.orders, c.startsAt, c.expiresAt])) },
        ]}
        previewActions={(c, close) => readOnly ? null : <Button size="sm" variant="outline" onClick={() => { close(); setMsg({}); setEditing(c); }}><Pencil /> Edit</Button>}
        preview={(c) => (
          <div className="space-y-4 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={c.active} disabled={readOnly || pending} aria-label={`${c.code} on or off`}
                onCheckedChange={(on) => start(async () => { setMsg(await setPromoCodeActive(c.id, on)); router.refresh(); })} />
              {c.active ? "On: customers can use it" : "Off"}
            </label>
            <p className="text-muted-foreground">{discountLabel(c)}</p>
            <dl className="divide-y rounded-xl border px-3">
              {[["Used", used(c)], ["Given", c.orders > 0 ? `${money(c.given)} on ${c.orders} order${c.orders === 1 ? "" : "s"}` : "—"], ...limits(c).map((l, i) => [i === 0 ? "Rules" : "", l])].map(([k, v], i) => (
                <div key={i} className="grid grid-cols-[6rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
              ))}
            </dl>
            {c.note && <p className="text-xs italic text-muted-foreground">{c.note}</p>}
          </div>
        )}
      />

      <ResponsivePanel id="promo-code" open={creating} onOpenChange={setCreating} defaultWidth={640}
        title="New promo code" description="Customers type the code in their cart.">
        <CreateForm products={products} onDone={(m) => { setMsg(m); if (m.ok) setCreating(false); }} />
      </ResponsivePanel>

      <ResponsivePanel id="promo-code" open={!!editing} onOpenChange={(o) => !o && setEditing(null)} defaultWidth={640}
        title={editing ? `Edit ${editing.code}` : "Edit promo code"}
        description="The discount, expiry, total uses, minimum order, products and first-time rule are fixed in Stripe. To change those, turn this code off and create a new one.">
        {editing && <EditForm row={editing} products={products} onDone={(m) => { setMsg(m); if (m.ok) setEditing(null); }} />}
      </ResponsivePanel>
    </div>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">{children}</h3>;
}

// Shared by create and edit: start date, maximum order, per customer, email, products, note.
type EchoFields = { startsOn: string; maxOrder: string; perCustomer: string; email: string; products: string[]; note: string };

function EchoRuleFields({ f, set, products, fixedProducts }: { f: EchoFields; set: (p: Partial<EchoFields>) => void; products: ProductOption[]; fixedProducts?: boolean }) {
  const kinds = [...new Set(products.map((p) => p.kind))];
  const toggle = (id: string, on: boolean) => set({ products: on ? [...f.products, id] : f.products.filter((p) => p !== id) });
  return (
    <>
      <Field label="Uses per customer" hint="Empty = no limit. 1 = once per account.">
        <Input type="number" min={1} step={1} placeholder="1" value={f.perCustomer} onChange={(e) => set({ perCustomer: e.target.value })} />
      </Field>
      <Field label="Maximum order ($)" hint="Only orders at or under this amount.">
        <Input type="number" min={0} step="0.01" placeholder="No maximum" value={f.maxOrder} onChange={(e) => set({ maxOrder: e.target.value })} />
      </Field>
      <Field label="Only for this customer (email)" hint="Empty = anyone." className="sm:col-span-2">
        <Input type="email" placeholder="name@example.com" value={f.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
      {!fixedProducts && <Field label="Applies to" hint="Nothing ticked = the whole order." className="sm:col-span-2">
        <div className="max-h-48 space-y-3 overflow-y-auto rounded-lg border p-3">
          {kinds.map((k) => (
            <div key={k} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{KIND_LABEL[k]}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {products.filter((p) => p.kind === k).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={f.products.includes(p.id)} onCheckedChange={(on) => toggle(p.id, Boolean(on))} />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Field>}
      <Field label="Private note" hint="Only staff see this (e.g. who it's for, which campaign)." className="sm:col-span-2">
        <Textarea rows={2} maxLength={500} value={f.note} onChange={(e) => set({ note: e.target.value })} />
      </Field>
    </>
  );
}

const echoInput = (f: EchoFields): Pick<PromoInput, "startsOn" | "maxOrder" | "perCustomer" | "email" | "products" | "note"> => ({
  startsOn: f.startsOn || null, maxOrder: num(f.maxOrder), perCustomer: num(f.perCustomer), email: f.email || null, products: f.products, note: f.note,
});

function CreateForm({ products, onDone }: { products: ProductOption[]; onDone: (m: Msg) => void }) {
  const [f, setF] = useState({
    code: "", name: "", type: "percent" as "percent" | "amount", value: "", duration: "once" as PromoInput["duration"], months: "",
    expiresOn: "", maxUses: "", minOrder: "", firstTimeOnly: false,
    startsOn: "", maxOrder: "", perCustomer: "", email: "", products: [] as string[], note: "",
  });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      setError(undefined);
      start(async () => {
        const res = await createPromoCode({
          code: f.code, name: f.name, type: f.type, value: Number(f.value), duration: f.duration, months: num(f.months),
          expiresOn: f.expiresOn || null, maxUses: num(f.maxUses), minOrder: num(f.minOrder), firstTimeOnly: f.firstTimeOnly, ...echoInput(f),
        });
        if (res.error) setError(res.error); else onDone(res);
      });
    }}>
      <Heading>Code</Heading>
      <Field label="Code" hint="What customers type. Letters, numbers, - and _.">
        <Input required maxLength={40} placeholder="LAUNCH20" className="uppercase" value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })} />
      </Field>
      <Field label="Name" hint="Shown on receipts. Defaults to the code.">
        <Input maxLength={40} placeholder="Launch week 20% off" value={f.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>

      <Heading>Discount</Heading>
      <Field label="Value">
        <div className="flex gap-2">
          <Pick label="Discount type" className="w-fit shrink-0" value={f.type} onChange={(v) => set({ type: v as "percent" | "amount" })} options={TYPE_OPTIONS} />
          <Input required type="number" min={f.type === "percent" ? 1 : 0.5} max={f.type === "percent" ? 100 : undefined} step={f.type === "percent" ? 1 : 0.01}
            placeholder={f.type === "percent" ? "20" : "10.00"} value={f.value} onChange={(e) => set({ value: e.target.value })} aria-label={f.type === "percent" ? "Percent off" : "Dollars off"} />
        </div>
      </Field>
      <Field label="On subscriptions" hint="One-time purchases are discounted once.">
        <div className="flex gap-2">
          <Pick label="Duration" className="min-w-0 flex-1" value={f.duration} onChange={(v) => set({ duration: v as PromoInput["duration"] })} options={DURATION_OPTIONS} />
          {f.duration === "repeating" && <Input type="number" min={1} max={36} placeholder="Months" className="w-24" value={f.months} onChange={(e) => set({ months: e.target.value })} aria-label="Months" />}
        </div>
      </Field>

      <Heading>Dates (Arizona time)</Heading>
      <Field label="Starts" hint="Empty = right away.">
        <DatePicker value={f.startsOn} onChange={(v) => set({ startsOn: v })} placeholder="Right away" />
      </Field>
      <Field label="Expires" hint="Ends at 11:59 pm that day. Empty = never.">
        <DatePicker value={f.expiresOn} onChange={(v) => set({ expiresOn: v })} placeholder="Never" />
      </Field>

      <Heading>Limits</Heading>
      <Field label="Total uses" hint="Across all customers, e.g. 1000. Empty = no limit.">
        <Input type="number" min={1} step={1} placeholder="No limit" value={f.maxUses} onChange={(e) => set({ maxUses: e.target.value })} />
      </Field>
      <Field label="Minimum order ($)" hint="Only orders at or over this amount.">
        <Input type="number" min={0} step="0.01" placeholder="No minimum" value={f.minOrder} onChange={(e) => set({ minOrder: e.target.value })} />
      </Field>
      <EchoRuleFields f={f} set={set} products={products} />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <Checkbox checked={f.firstTimeOnly} onCheckedChange={(on) => set({ firstTimeOnly: Boolean(on) })} />
        First-time customers only (no earlier purchase)
      </label>

      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create code"}</Button>
      </div>
    </form>
  );
}

function EditForm({ row, products, onDone }: { row: PromoRow; products: ProductOption[]; onDone: (m: Msg) => void }) {
  const [f, setF] = useState<EchoFields>({
    startsOn: toDay(row.startsAt), maxOrder: str(row.maxOrder, 100), perCustomer: str(row.perCustomer), email: row.email ?? "", products: row.products, note: row.note,
  });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (p: Partial<EchoFields>) => setF((x) => ({ ...x, ...p }));

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      setError(undefined);
      start(async () => {
        const res = await updatePromoCode(row.id, echoInput(f));
        if (res.error) setError(res.error); else onDone(res);
      });
    }}>
      <div className="rounded-lg bg-muted/50 p-3 text-sm sm:col-span-2">
        <p className="font-medium">{row.name} · {discountLabel(row)}</p>
        <p className="text-xs text-muted-foreground">
          {[row.expiresAt ? `Expires ${showDay(row.expiresAt)}` : "Never expires", row.maxUses != null ? `${row.maxUses.toLocaleString()} total uses` : "No total limit",
            row.minOrder != null ? `Orders ${money(row.minOrder)}+` : null, row.firstTimeOnly ? "First-time customers" : null,
            row.products.length ? `Only ${row.products.map((id) => products.find((p) => p.id === id)?.name ?? id).join(", ")}` : "Whole order"].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Field label="Starts (Arizona time)" hint="Empty = right away." className="sm:col-span-2">
        <DatePicker value={f.startsOn} onChange={(v) => set({ startsOn: v })} placeholder="Right away" />
      </Field>
      <EchoRuleFields f={f} set={set} products={products} fixedProducts />
      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
