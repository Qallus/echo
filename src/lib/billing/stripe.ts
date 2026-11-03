import "server-only";
import Stripe from "stripe";
import { secret } from "@/lib/secrets";

// Null until a Stripe secret key is set (Admin -> Settings -> Integrations,
// or STRIPE_SECRET_KEY in Coolify), so the store can show "checkout isn't
// available yet" instead of crashing. Rebuilt when the key changes.
let client: { key: string; stripe: Stripe } | null = null;
export async function stripe(): Promise<Stripe | null> {
  const key = await secret("STRIPE_SECRET_KEY");
  if (!key) return null;
  if (client?.key !== key) client = { key, stripe: new Stripe(key) };
  return client.stripe;
}

export const stripeReady = async () => Boolean(await secret("STRIPE_SECRET_KEY"));
