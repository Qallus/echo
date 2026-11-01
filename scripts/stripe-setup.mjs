// Creates (or updates) Echo's products and prices in Stripe from
// src/lib/billing/catalog.ts. Safe to re-run: prices are matched by lookup_key,
// and a changed amount gets a new price that takes over the lookup_key.
//   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
// (reads STRIPE_SECRET_KEY from .env.local if not set)

import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import Stripe from "stripe";

const root = resolve(import.meta.dirname, "..");
if (!process.env.STRIPE_SECRET_KEY && fs.existsSync(`${root}/.env.local`)) {
  const m = fs.readFileSync(`${root}/.env.local`, "utf8").match(/^STRIPE_SECRET_KEY=(.*)$/m);
  if (m) process.env.STRIPE_SECRET_KEY = m[1].trim();
}
if (!process.env.STRIPE_SECRET_KEY) throw new Error("Set STRIPE_SECRET_KEY (test key: sk_test_...).");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Load the TypeScript catalog by stripping its types (it has no imports).
const require = createRequire(import.meta.url);
const ts = require("typescript");
const src = fs.readFileSync(`${root}/src/lib/billing/catalog.ts`, "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const tmp = `${root}/.next/catalog.tmp.mjs`;
fs.mkdirSync(`${root}/.next`, { recursive: true });
fs.writeFileSync(tmp, js);
const { PRODUCTS } = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const p of PRODUCTS) {
  const found = await stripe.products.search({ query: `metadata['echo_id']:'${p.id}'` });
  const product = found.data[0]
    ? await stripe.products.update(found.data[0].id, { name: `Echo ${p.name}`, description: p.tagline, active: true })
    : await stripe.products.create({ name: `Echo ${p.name}`, description: p.tagline, metadata: { echo_id: p.id, echo_kind: p.kind } });

  for (const price of p.prices) {
    const existing = (await stripe.prices.list({ lookup_keys: [price.key], expand: ["data.tiers"], limit: 1 })).data[0];
    const wantTiers = price.tiers?.map((t) => ({ up_to: t.upTo ?? "inf", unit_amount: t.unitAmount }));
    const haveTiers = existing?.tiers?.map((t) => ({ up_to: t.up_to ?? "inf", unit_amount: t.unit_amount }));
    const unchanged = existing && existing.product === product.id &&
      (price.tiers ? same(wantTiers, haveTiers) : existing.unit_amount === price.unitAmount) &&
      (existing.recurring?.interval ?? null) === price.interval;
    if (unchanged) { console.log(`= ${price.key}`); continue; }

    await stripe.prices.create({
      product: product.id,
      currency: "usd",
      lookup_key: price.key,
      transfer_lookup_key: true,
      ...(price.interval ? { recurring: { interval: price.interval } } : {}),
      ...(price.tiers
        ? { billing_scheme: "tiered", tiers_mode: "graduated", tiers: wantTiers }
        : { unit_amount: price.unitAmount }),
      metadata: { echo_id: p.id },
    });
    if (existing) await stripe.prices.update(existing.id, { active: false });
    console.log(`${existing ? "~" : "+"} ${price.key}`);
  }
}
console.log("Stripe catalog is in sync.");
